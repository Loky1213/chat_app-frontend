import { useEffect, useRef, useCallback } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { useReadReceiptsStore } from '@/store/useReadReceiptsStore';
import { Message } from '@/types/chat';
import { useAuth } from '@/context/AuthContext';

// ─── MODULE-LEVEL SINGLETON STATE ───────────────────────────────────────────
// Ensures only ONE chat socket exists per conversation, even with React strict mode
let chatWsInstance: WebSocket | null = null;
let chatWsConversationId: string | null = null;
let chatWsRetryCount = 0;
let chatWsReconnectTimeout: NodeJS.Timeout | null = null;
// Track processed message IDs to prevent duplicate event handling
const chatProcessedMessageIds = new Set<string>();
const MAX_PROCESSED_IDS = 500;

const cleanupProcessedIds = () => {
  if (chatProcessedMessageIds.size > MAX_PROCESSED_IDS) {
    const idsArray = Array.from(chatProcessedMessageIds);
    const toRemove = idsArray.slice(0, idsArray.length - MAX_PROCESSED_IDS / 2);
    toRemove.forEach(id => chatProcessedMessageIds.delete(id));
  }
};

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
  
  const mountedRef = useRef(true);
  const visibilityHandlerRef = useRef<(() => void) | null>(null);

  const getWsUrl = (id: string): string => {
    const baseWsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://127.0.0.1:8000';
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
    console.log('[ChatWS] Token present:', !!token, 'Token length:', token?.length);
    console.log('[ChatWS] Connecting to:', `${baseWsUrl}/ws/chat/${id}/`);
    return `${baseWsUrl}/ws/chat/${id}/?token=${token}`;
  };

  useEffect(() => {
    mountedRef.current = true;

    // ─── CLEANUP PREVIOUS SOCKET IF CONVERSATION CHANGED ────────────────────
    if (chatWsInstance && chatWsConversationId !== conversationId) {
      console.log(`[ChatWS] CLOSED: ${chatWsConversationId} — switching to ${conversationId}`);
      chatWsInstance.onclose = null; // Prevent reconnect attempts
      chatWsInstance.close();
      chatWsInstance = null;
      chatWsConversationId = null;
      setSocket(null);
      
      if (chatWsReconnectTimeout) {
        clearTimeout(chatWsReconnectTimeout);
        chatWsReconnectTimeout = null;
      }
      chatWsRetryCount = 0;
    }

    // ─── NO CONVERSATION SELECTED ───────────────────────────────────────────
    if (!conversationId) {
      return;
    }

    const connect = () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      if (!token) {
        console.warn('[ChatWS] Skipped: no token');
        return;
      }

      // CRITICAL: Check if socket already exists for this conversation
      if (chatWsInstance && chatWsConversationId === conversationId) {
        const state = chatWsInstance.readyState;
        if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {
          console.log(`[ChatWS] Already connected to ${conversationId} — skipping`);
          return;
        }
      }

      console.log(`[ChatWS] CREATED: ${conversationId}`);
      const socket = new WebSocket(getWsUrl(conversationId));
      chatWsInstance = socket;
      chatWsConversationId = conversationId;

      socket.onopen = () => {
        console.log(`[ChatWS] CONNECTED: ${conversationId}`);
        chatWsRetryCount = 0;
        setSocket(socket);
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case 'message': {
              const newMessage: Message = data.data || data;
              const msgId = String(newMessage.id || '');
              
              // Deduplicate: check if we've already processed this message
              if (msgId && chatProcessedMessageIds.has(`chat_${msgId}`)) {
                return;
              }
              if (msgId) {
                chatProcessedMessageIds.add(`chat_${msgId}`);
                cleanupProcessedIds();
              }
              
              // Track if this is MY message and read receipts is currently disabled
              const senderId = String(newMessage.sender?.id ?? (newMessage as any).sender_id);
              if (user?.id && senderId === String(user.id) && msgId) {
                useReadReceiptsStore.getState().trackMessageSentWhileDisabled(msgId);
              }
              
              addMessage(newMessage);
              break;
            }

            case 'new_message':
            case 'forwarded_message': {
              const msgPayload: Message | undefined = data.last_message || data.data;
              if (msgPayload) {
                const msgId = String(msgPayload.id || '');
                
                // Deduplicate
                if (msgId && chatProcessedMessageIds.has(`chat_${msgId}`)) {
                  return;
                }
                if (msgId) {
                  chatProcessedMessageIds.add(`chat_${msgId}`);
                  cleanupProcessedIds();
                }
                
                // Track if this is MY message and read receipts is currently disabled
                const senderId = String(msgPayload.sender?.id ?? (msgPayload as any).sender_id);
                if (user?.id && senderId === String(user.id) && msgId) {
                  useReadReceiptsStore.getState().trackMessageSentWhileDisabled(msgId);
                }
                
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

      socket.onerror = (err) => {
        console.error(`[ChatWS] Error on ${conversationId}:`, err);
      };

      socket.onclose = (event) => {
        console.log(`[ChatWS] CLOSED: ${conversationId} — code: ${event.code}`);
        
        // Only clear if this is still the active socket for this conversation
        if (chatWsConversationId === conversationId) {
          chatWsInstance = null;
          chatWsConversationId = null;
          setSocket(null);

          if (event.code === 1008) {
            console.warn('[ChatWS] Auth rejected — not retrying');
            return;
          }

          // Only retry if component is still mounted and same conversation is active
          if (mountedRef.current) {
            const delay = Math.min(1000 * Math.pow(2, chatWsRetryCount), 10000);
            chatWsRetryCount++;

            if (chatWsReconnectTimeout) {
              clearTimeout(chatWsReconnectTimeout);
            }
            chatWsReconnectTimeout = setTimeout(() => {
              if (mountedRef.current && useChatStore.getState().activeConversationId === conversationId) {
                connect();
              }
            }, delay);
          }
        }
      };
    };

    connect();

    // Visibility change handler for this conversation
    if (visibilityHandlerRef.current) {
      document.removeEventListener('visibilitychange', visibilityHandlerRef.current);
    }
    
    visibilityHandlerRef.current = () => {
      if (document.visibilityState === 'visible') {
        if (!chatWsInstance || chatWsInstance.readyState !== WebSocket.OPEN) {
          if (useChatStore.getState().activeConversationId === conversationId) {
            console.log(`[ChatWS] Visibility change — reconnecting to ${conversationId}`);
            connect();
          }
        }
      }
    };
    document.addEventListener('visibilitychange', visibilityHandlerRef.current);

    return () => {
      mountedRef.current = false;
      
      if (visibilityHandlerRef.current) {
        document.removeEventListener('visibilitychange', visibilityHandlerRef.current);
        visibilityHandlerRef.current = null;
      }
      
      if (chatWsReconnectTimeout) {
        clearTimeout(chatWsReconnectTimeout);
        chatWsReconnectTimeout = null;
      }

      // Close socket on cleanup (conversation change or unmount)
      if (chatWsInstance && chatWsConversationId === conversationId) {
        console.log(`[ChatWS] CLEANUP CLOSE: ${conversationId}`);
        chatWsInstance.onclose = null;
        chatWsInstance.close();
        chatWsInstance = null;
        chatWsConversationId = null;
        setSocket(null);
      }
    };
  }, [conversationId, addMessage, addReadReceipt, updateMessage, removeMessage, setTyping, setSocket, updateMessageReactions, handleUnreadReset]);

  const sendMessage = useCallback((content: string, replyToId?: string) => {
    if (chatWsInstance && chatWsInstance.readyState === WebSocket.OPEN) {
      chatWsInstance.send(JSON.stringify({
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
    if (chatWsInstance && chatWsInstance.readyState === WebSocket.OPEN) {
      chatWsInstance.send(JSON.stringify({ action: 'delete_message', message_id: messageId, mode }));
    }
  }, []);

  const sendReaction = useCallback((messageId: string, emoji: string) => {
    if (chatWsInstance && chatWsInstance.readyState === WebSocket.OPEN) {
      chatWsInstance.send(JSON.stringify({ action: 'react', message_id: messageId, emoji }));
    }
  }, []);

  const sendTyping = useCallback(() => {
    if (chatWsInstance && chatWsInstance.readyState === WebSocket.OPEN) {
      chatWsInstance.send(JSON.stringify({ action: 'typing' }));
    }
  }, []);

  const lastReadReceiptTime = useRef<number>(0);
  const lastReadMessageId = useRef<string | null>(null);

  const sendReadReceipt = useCallback((messageId?: string) => {
    // If read receipts is OFF, don't send read receipts to others
    const isReadReceiptsEnabled = useReadReceiptsStore.getState().isEnabled;
    if (!isReadReceiptsEnabled) {
      console.log('[ChatWS] Read receipts disabled, not sending read receipt');
      return;
    }
    
    if (chatWsInstance && chatWsInstance.readyState === WebSocket.OPEN) {
      if (messageId && messageId === lastReadMessageId.current) return;
      const now = Date.now();
      if (!messageId && now - lastReadReceiptTime.current < 1000) return;
      lastReadReceiptTime.current = now;
      if (messageId) lastReadMessageId.current = messageId;
      chatWsInstance.send(JSON.stringify({
        action: 'mark_read',
        ...(messageId ? { message_id: messageId } : {})
      }));
    }
  }, []);

  return { 
    sendMessage, 
    sendDeleteMessage, 
    sendTyping, 
    sendReadReceipt, 
    sendReaction, 
    socketReadyState: chatWsInstance?.readyState 
  };
};