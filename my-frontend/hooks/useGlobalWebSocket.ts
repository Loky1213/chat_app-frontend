import { useEffect, useRef } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { usePresenceStore } from '@/store/usePresenceStore';

// 🔥 GLOBAL SINGLETONS
let globalWsInstance: WebSocket | null = null;
let globalWsRetryCount = 0;
let globalWsReconnectTimeout: NodeJS.Timeout | null = null;
let globalWsVisibilityListenerAdded = false;

export const useGlobalWebSocket = () => {
  const mounted = useRef(true);

  const getToken = () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('access_token');
  };

  const decodeToken = (token: string) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  };

  const getWsUrl = () => {
    const baseWsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://127.0.0.1:8000';
    const token = getToken();
    return `${baseWsUrl}/ws/notifications/?token=${token}`;
  };

  useEffect(() => {
    mounted.current = true;

    const connect = () => {
      const token = getToken();

      // 🔒 Do not connect without token
      if (!token) {
        console.warn('WS skipped: no token');
        return;
      }

      // 🔥 Prevent duplicate / already open socket
      if (
        globalWsInstance &&
        globalWsInstance.readyState === WebSocket.OPEN
      ) {
        console.log('WS already connected');
        return;
      }

      console.log('WS INIT');

      const socket = new WebSocket(getWsUrl());
      globalWsInstance = socket;

      socket.onopen = () => {
        console.log('WS OPEN');
        globalWsRetryCount = 0;

        const state = useChatStore.getState();

        // Optional resync
        if (state.conversations.length === 0) {
          state.fetchConversations();

          if (state.activeConversationId && state.fetchMessages) {
            state.fetchMessages(state.activeConversationId);
          }
        }
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // VERIFY EVENT DELIVERY
          console.log("WS EVENT RECEIVED:", data);
          
          // VERIFY EVENT TYPE
          console.log("EVENT TYPE:", data.type);

          const eventType = data.type ? String(data.type).toUpperCase() : '';
          const messageObj = data.message || data.last_message || data;
          
          // VERIFY CHAT ID
          const effectiveChatId = messageObj?.chat_id || messageObj?.conversation_id || data.conversation_id;
          console.log("CHAT ID:", effectiveChatId);

          // Handle all permutations
          if (eventType === 'NEW_MESSAGE' || eventType === 'FORWARDED_MESSAGE' || eventType === 'MESSAGE') {
            console.log(`[WS Global] Processing ${eventType} for conversation ${effectiveChatId}`);
            const token = getToken();
            const currentUserId = token ? decodeToken(token)?.user_id : undefined;
            
            const normalizedPayload = {
              ...data,
              last_message: messageObj,
              conversation_id: effectiveChatId
            };
            
            useChatStore.getState().handleIncomingMessage(normalizedPayload, currentUserId);
          }

          // FIRE UNREAD RESET
          if (eventType === 'UNREAD_RESET') {
            if (effectiveChatId) {
              useChatStore.getState().handleUnreadReset(String(effectiveChatId));
            }
          }

          // GROUP UPDATES (Admin, Members, etc)
          if (eventType.includes('GROUP') || eventType.includes('ADMIN') || eventType === 'UPDATE_CONVERSATION') {
            useChatStore.getState().fetchConversations();
            if (effectiveChatId) {
                useChatStore.getState().fetchMessages(String(effectiveChatId));
            }
          }

          // 🔥 Handle presence updates via WebSocket
          if (data.type === 'presence_update') {
            const { user_id, status } = data;
            if (status === 'user_online') {
              usePresenceStore.getState().setUserOnline(String(user_id));
            } else if (status === 'user_offline') {
              usePresenceStore.getState().setUserOffline(String(user_id));
            }
          }
        } catch (err) {
          console.error('WS parse error:', err);
        }
      };

      socket.onerror = () => {
        console.warn('WS ERROR (expected sometimes)');
      };

      socket.onclose = (event) => {
        console.log('WS CLOSED:', event.code, event.reason);

        globalWsInstance = null;

        // 🚫 Auth failure → stop reconnect
        if (event.code === 1008) {
          console.warn('WS auth failed');
          return;
        }

        // 🔁 Reconnect with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, globalWsRetryCount), 10000);
        globalWsRetryCount++;

        if (globalWsReconnectTimeout) {
          clearTimeout(globalWsReconnectTimeout);
        }

        globalWsReconnectTimeout = setTimeout(() => {
          if (mounted.current) {
            connect();
          }
        }, delay);
      };
    };

    connect();

    // 🔁 Handle tab visibility (important)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (
          !globalWsInstance ||
          globalWsInstance.readyState !== WebSocket.OPEN
        ) {
          console.log('WS reconnect on tab focus');
          connect();
        }
      }
    };

    if (!globalWsVisibilityListenerAdded && typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      globalWsVisibilityListenerAdded = true;
    }

    return () => {
      mounted.current = false;

      if (globalWsReconnectTimeout) {
        clearTimeout(globalWsReconnectTimeout);
      }

      // ❗ DO NOT close global socket here
      // This is a global connection, not component-scoped
    };
  }, []);
};
