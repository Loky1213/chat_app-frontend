import { useEffect, useRef } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { usePresenceStore } from '@/store/usePresenceStore';

// GLOBAL SINGLETONS — one shared connection for the entire app lifetime
let globalWsInstance: WebSocket | null = null;
let globalWsRetryCount = 0;
let globalWsReconnectTimeout: NodeJS.Timeout | null = null;
let globalWsVisibilityListenerAdded = false;
// FIX: cache the decoded user_id so we don't re-decode on every message
let cachedCurrentUserId: string | undefined = undefined;

export const useGlobalWebSocket = () => {
  const mounted = useRef(true);

  const getToken = (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('access_token');
  };

  const decodeToken = (token: string): any => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch {
      return null;
    }
  };

  const getWsUrl = (): string => {
    const baseWsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://127.0.0.1:8000';
    const token = getToken();
    return `${baseWsUrl}/ws/notifications/?token=${token}`;
  };

  useEffect(() => {
    mounted.current = true;

    const connect = () => {
      const token = getToken();

      if (!token) {
        console.warn('[GlobalWS] Skipped: no token');
        return;
      }

      if (globalWsInstance && globalWsInstance.readyState === WebSocket.OPEN) {
        return;
      }

      // FIX: decode user_id once per connection, not on every message
      cachedCurrentUserId = token ? String(decodeToken(token)?.user_id) : undefined;

      const socket = new WebSocket(getWsUrl());
      globalWsInstance = socket;

      socket.onopen = () => {
        globalWsRetryCount = 0;

        const state = useChatStore.getState();
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
          const eventType = data.type ? String(data.type).toUpperCase() : '';
          const messageObj = data.message || data.last_message || data;
          const effectiveChatId =
            messageObj?.chat_id ||
            messageObj?.conversation_id ||
            data.conversation_id;

          // FIX: For NEW_MESSAGE / FORWARDED_MESSAGE, only update the sidebar
          // (conversations list). The chat-scoped socket (useChatWebSocket) handles
          // adding the actual message to state.messages to avoid duplicates.
          if (
            eventType === 'NEW_MESSAGE' ||
            eventType === 'FORWARDED_MESSAGE' ||
            eventType === 'MESSAGE'
          ) {
            const normalizedPayload = {
              ...data,
              last_message: messageObj,
              conversation_id: effectiveChatId
            };
            // Pass cached userId — no re-decode per message
            useChatStore.getState().handleIncomingMessage(normalizedPayload, cachedCurrentUserId);
          }

          if (eventType === 'UNREAD_RESET') {
            if (effectiveChatId) {
              useChatStore.getState().handleUnreadReset(String(effectiveChatId));
            }
          }

          if (
            eventType.includes('GROUP') ||
            eventType.includes('ADMIN') ||
            eventType === 'UPDATE_CONVERSATION'
          ) {
            useChatStore.getState().fetchConversations();
            if (effectiveChatId) {
              useChatStore.getState().fetchMessages(String(effectiveChatId));
            }
          }

          if (data.type === 'presence_update') {
            const { user_id, status } = data;
            if (status === 'user_online') {
              usePresenceStore.getState().setUserOnline(String(user_id));
            } else if (status === 'user_offline') {
              usePresenceStore.getState().setUserOffline(String(user_id));
            }
          }
        } catch (err) {
          console.error('[GlobalWS] Parse error:', err);
        }
      };

      socket.onerror = () => {
        // Errors are expected on transient network issues; onclose handles retry
      };

      socket.onclose = (event) => {
        globalWsInstance = null;
        cachedCurrentUserId = undefined;

        if (event.code === 1008) {
          console.warn('[GlobalWS] Auth failed — not retrying');
          return;
        }

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

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (!globalWsInstance || globalWsInstance.readyState !== WebSocket.OPEN) {
          connect();
        }
      }
    };

    // FIX: track the handler reference so we can remove it properly on cleanup
    if (!globalWsVisibilityListenerAdded && typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      globalWsVisibilityListenerAdded = true;
    }

    return () => {
      mounted.current = false;
      if (globalWsReconnectTimeout) {
        clearTimeout(globalWsReconnectTimeout);
      }
      // Do NOT close the global socket here — it lives beyond component unmount
    };
  }, []);
};