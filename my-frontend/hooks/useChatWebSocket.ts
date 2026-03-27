import { useEffect, useRef, useCallback } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { Message } from '@/types/chat';

export const useChatWebSocket = (conversationId: string | null) => {
  const { 
    addMessage, 
    addReadReceipt,
    updateMessage,
    removeMessage,
    setTyping,
    setSocket,
    updateMessageReactions 
  } = useChatStore();
  const ws = useRef<WebSocket | null>(null);

  const getWsUrl = (id: string) => {
    // Using localhost to match the backend CORS_ALLOWED_ORIGINS configuration
    const baseWbUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://127.0.0.1:8000';
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
    return `${baseWbUrl}/ws/chat/${id}/?token=${token}`;
  };

  useEffect(() => {
    if (!conversationId) {
      if (ws.current) {
        ws.current.close();
        ws.current = null;
        setSocket(null);
      }
      return;
    }

    let reconnectTimeoutId: NodeJS.Timeout | null = null;
    let retryCount = 0;
    let isComponentMounted = true;

    const connect = () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      if (!token) return;

      if (ws.current) return;

      console.log(`WS INIT (Chat: ${conversationId})`);
      const url = getWsUrl(conversationId);
      const socket = new WebSocket(url);

      socket.onopen = () => {
        console.log(`WS OPEN (Chat: ${conversationId})`);
        retryCount = 0;
        setSocket(socket);
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'message': {
              const newMessage: Message = data.data || data;
              addMessage(newMessage);
              break;
            }
            case 'new_message': {
              const newMessage: Message = data.last_message;
              if (newMessage) {
                addMessage(newMessage);
              }
              break;
            }
            case 'read_receipt': 
            case 'message_seen': {
              const userIdMapping = Number(data.user_id);
              addReadReceipt(userIdMapping, data.message_id);
              break;
            }
            case 'message_deleted': {
              if (data.mode === 'me') {
                removeMessage(data.message_id);
              } else {
                updateMessage(data.message_id, {
                  is_deleted: true,
                  deleted_for_everyone: true,
                  content: 'This message was deleted',
                  message_type: 'deleted'
                });
              }
              break;
            }
            case 'typing': {
              setTyping(Number(data.user_id));
              break;
            }
            case 'reaction_update': {
              if (data.message_id && data.reactions) {
                updateMessageReactions(data.message_id, data.reactions);
              }
              break;
            }
          }
        } catch (err) {
          console.error('Error parsing WS message:', err);
        }
      };

      socket.onerror = (error) => {
        console.warn('WS ERROR (expected sometimes)', error);
      };

      socket.onclose = (event) => {
        console.log(`WS CLOSED (Chat: ${conversationId}):`, event.code, event.reason);
        setSocket(null);
        ws.current = null;

        if (event.code === 1008) {
          console.warn('Backend rejected auth token for Chat socket');
          return;
        }

        const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
        retryCount++;

        if (reconnectTimeoutId) clearTimeout(reconnectTimeoutId);
        reconnectTimeoutId = setTimeout(() => {
          if (isComponentMounted) connect();
        }, delay);
      };

      ws.current = socket;
    };

    connect();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
          connect();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isComponentMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      if (reconnectTimeoutId) clearTimeout(reconnectTimeoutId);
      if (ws.current) {
        ws.current.onclose = null; 
        ws.current.close();
        ws.current = null;
        setSocket(null);
      }
    };
  }, [conversationId, addMessage, addReadReceipt, updateMessage, removeMessage, setTyping, setSocket, updateMessageReactions]);

  const sendMessage = useCallback((content: string, replyToId?: string) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        action: 'send_message',
        message: content,
        type: 'text',
        ...(replyToId ? { reply_to: replyToId } : {})
      }));
    } else {
      console.warn('Cannot send message: WebSocket is not open');
    }
  }, []);

  const sendDeleteMessage = useCallback((messageId: string, mode: 'me' | 'everyone') => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        action: 'delete_message',
        message_id: messageId,
        mode
      }));
    }
  }, []);

  const sendReaction = useCallback((messageId: string, emoji: string) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        action: 'react',
        message_id: messageId,
        emoji
      }));
    }
  }, []);

  const sendTyping = useCallback(() => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        action: 'typing'
      }));
    }
  }, []);

  const lastReadReceiptTime = useRef<number>(0);
  const lastReadMessageId = useRef<string | null>(null);

  const sendReadReceipt = useCallback((messageId?: string) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      // Deduplicate consecutive identical receipts
      if (messageId && messageId === lastReadMessageId.current) return;
      
      const now = Date.now();
      // Throttle global mark-read (empty messageId) to at most once per second
      if (!messageId && now - lastReadReceiptTime.current < 1000) return;

      lastReadReceiptTime.current = now;
      if (messageId) {
        lastReadMessageId.current = messageId;
      }

      ws.current.send(JSON.stringify({
        action: 'mark_read',
        ...(messageId ? { message_id: messageId } : {})
      }));
    }
  }, []);

  return { sendMessage, sendDeleteMessage, sendTyping, sendReadReceipt, sendReaction, socketReadyState: ws.current?.readyState };
};
