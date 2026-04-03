import { useEffect, useRef, useCallback } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { Message } from '@/types/chat';
import { useAuth } from '@/context/AuthContext';

export const useChatWebSocket = (conversationId: string | null) => {
  const { user } = useAuth();
  const addMessage = useChatStore((s) => s.addMessage);
  const addReadReceipt = useChatStore((s) => s.addReadReceipt);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const removeMessage = useChatStore((s) => s.removeMessage);
  const setTyping = useChatStore((s) => s.setTyping);
  const setSocket = useChatStore((s) => s.setSocket);
  const updateMessageReactions = useChatStore((s) => s.updateMessageReactions);
  const updateConversationOnSend = useChatStore((s) => s.updateConversationOnSend);
  const handleUnreadReset = useChatStore((s) => s.handleUnreadReset);
  const ws = useRef<WebSocket | null>(null);

  const getWsUrl = (id: string): string => {
    const baseWsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://127.0.0.1:8000';
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
    return `${baseWsUrl}/ws/chat/${id}/?token=${token}`;
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

      const socket = new WebSocket(getWsUrl(conversationId));

      socket.onopen = () => {
        retryCount = 0;
        setSocket(socket);
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {

            // ─── PRIMARY message path ───────────────────────────────────────────────
            // The backend's chat_message handler sends type: "message" with data: {...}
            // This is the authoritative source for adding messages to the store.
            case 'message': {
              const newMessage: Message = data.data || data;
              addMessage(newMessage);
              break;
            }

            // ─── SECONDARY paths: new_message / forwarded_message ─────────────────
            // The backend ALSO broadcasts new_message to the same room group.
            // This means for every sent message, both 'message' AND 'new_message'
            // arrive on this same socket — causing duplicates.
            //
            // FIX: addMessage has built-in ID-based dedup in the store, so calling it
            // here is safe — but ONLY works if the IDs match exactly (same type).
            // Ensure IDs are always stringified before comparing in addMessage (done in store).
            // For forwarded_message, last_message is the only payload so we must add it.
            case 'new_message':
            case 'forwarded_message': {
              const msgPayload: Message | undefined = data.last_message || data.data;
              if (msgPayload) {
                // addMessage dedup in the store (String(m.id) === String(safe.id)) handles
                // the case where 'message' already inserted this — no visible duplicate.
                addMessage(msgPayload);
              }
              break;
            }

            case 'read_receipt':
            case 'message_seen': {
              const userIdNum = Number(data.user_id);
              addReadReceipt(userIdNum, data.message_id);
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
              // Always string — matches participant ID comparison in MessageList
              setTyping(String(data.user_id));
              break;
            }

            case 'reaction_update': {
              if (data.message_id && data.reactions) {
                updateMessageReactions(data.message_id, data.reactions);
              }
              break;
            }

            case 'unread_reset': {
              const chatId = data.conversation_id || data.chat_id;
              if (chatId) handleUnreadReset(String(chatId));
              break;
            }

            case 'group_update':
            case 'group_updated':
            case 'admin_updated':
            case 'participant_updated':
            case 'update_conversation': {
              useChatStore.getState().fetchConversations();
              if (conversationId) {
                useChatStore.getState().fetchMessages(conversationId);
              }
              break;
            }
          }
        } catch (err) {
          console.error('[ChatWS] Parse error:', err);
        }
      };

      socket.onerror = () => {};

      socket.onclose = (event) => {
        setSocket(null);
        ws.current = null;

        if (event.code === 1008) {
          console.warn('[ChatWS] Auth rejected');
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

      if (user && conversationId) {
        updateConversationOnSend({
          id: `temp_${Date.now()}`,
          content,
          created_at: new Date().toISOString(),
          sender: user,
          conversation_id: conversationId,
          message_type: 'text',
        });
      }
    } else {
      console.warn('[ChatWS] Cannot send: socket not open');
    }
  }, [user, conversationId, updateConversationOnSend]);

  const sendDeleteMessage = useCallback((messageId: string, mode: 'me' | 'everyone') => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ action: 'delete_message', message_id: messageId, mode }));
    }
  }, []);

  const sendReaction = useCallback((messageId: string, emoji: string) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ action: 'react', message_id: messageId, emoji }));
    }
  }, []);

  const sendTyping = useCallback(() => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ action: 'typing' }));
    }
  }, []);

  const lastReadReceiptTime = useRef<number>(0);
  const lastReadMessageId = useRef<string | null>(null);

  const sendReadReceipt = useCallback((messageId?: string) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      if (messageId && messageId === lastReadMessageId.current) return;
      const now = Date.now();
      if (!messageId && now - lastReadReceiptTime.current < 1000) return;
      lastReadReceiptTime.current = now;
      if (messageId) lastReadMessageId.current = messageId;
      ws.current.send(JSON.stringify({
        action: 'mark_read',
        ...(messageId ? { message_id: messageId } : {})
      }));
    }
  }, []);

  return { sendMessage, sendDeleteMessage, sendTyping, sendReadReceipt, sendReaction, socketReadyState: ws.current?.readyState };
};