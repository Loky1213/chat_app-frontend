import { useEffect, useRef, useCallback } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { Message } from '@/types/chat';

export const useChatWebSocket = (conversationId: string | null) => {
  const { 
    addMessage, 
    addReadReceipt,
    updateMessage,
    removeMessage,
    setOnline,
    setOffline,
    setTyping,
    setSocket 
  } = useChatStore();
  const ws = useRef<WebSocket | null>(null);

  const getWsUrl = (id: string) => {
    // Using localhost to match the backend CORS_ALLOWED_ORIGINS configuration
    const baseWbUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
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

    let reconnectTimeoutId: NodeJS.Timeout;

    const connect = () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      if (!token) {
        console.warn('Cannot connect to WebSocket: No access_token found in localStorage');
        // Do not attempt to establish the connection if token is missing
        return;
      }

      console.log(`Connecting WebSocket to conversation: ${conversationId} with token: ${token.substring(0, 15)}...`);
      const url = getWsUrl(conversationId);
      const socket = new WebSocket(url);

      socket.onopen = () => {
        console.log('Chat WebSocket Connected:', conversationId);
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
            case 'read_receipt': // legacy handling, depending on backend implementation
            case 'message_seen': {
              const userIdMapping = Number(data.user_id);
              addReadReceipt(userIdMapping, data.message_id);
              break;
            }
            case 'user_online': {
              setOnline(Number(data.user_id));
              break;
            }
            case 'user_offline': {
              setOffline(Number(data.user_id));
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
          }
        } catch (err) {
          console.error('Error parsing WS message:', err);
        }
      };

      socket.onerror = (error) => {
        console.error('Chat WebSocket Error:', error);
      };

      socket.onclose = () => {
        console.log('Chat WebSocket Disconnected. Rescheduling connection...');
        setSocket(null);
        // Implement simple auto-reconnect logic
        reconnectTimeoutId = setTimeout(connect, 3000);
      };

      ws.current = socket;
    };

    connect();

    return () => {
      // Clean up cleanly on unmount or active conversation switch
      clearTimeout(reconnectTimeoutId);
      if (ws.current) {
        // Remove the close listener so we don't accidentally auto-reconnect when deliberately destroying the component
        ws.current.onclose = null; 
        ws.current.close();
        ws.current = null;
        setSocket(null);
      }
    };
  }, [conversationId, addMessage, addReadReceipt, updateMessage, removeMessage, setOnline, setOffline, setTyping, setSocket]);

  const sendMessage = useCallback((content: string) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        action: 'send_message',
        message: content,
        type: 'text'
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

  return { sendMessage, sendDeleteMessage, sendTyping, sendReadReceipt, socketReadyState: ws.current?.readyState };
};
