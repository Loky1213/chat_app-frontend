import { useEffect, useRef } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { usePresenceStore } from '@/store/usePresenceStore';

// ─── GLOBAL SINGLETON STATE ─────────────────────────────────────────────────
// These module-level variables ensure only ONE global WebSocket exists
// across all component instances and React strict mode double-mounts.
let globalWsInstance: WebSocket | null = null;
let globalWsRetryCount = 0;
let globalWsReconnectTimeout: NodeJS.Timeout | null = null;
let globalWsVisibilityHandler: (() => void) | null = null;
let cachedCurrentUserId: string | undefined = undefined;
// Track processed message IDs to prevent duplicate event handling
const processedMessageIds = new Set<string>();
const MAX_PROCESSED_IDS = 500; // Prevent memory leak

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
  console.log('[GlobalWS] Token present:', !!token, 'Token length:', token?.length);
  console.log('[GlobalWS] Connecting to:', `${baseWsUrl}/ws/notifications/`);
  return `${baseWsUrl}/ws/notifications/?token=${token}`;
};

// Cleanup old processed IDs to prevent memory leak
const cleanupProcessedIds = () => {
  if (processedMessageIds.size > MAX_PROCESSED_IDS) {
    const idsArray = Array.from(processedMessageIds);
    const toRemove = idsArray.slice(0, idsArray.length - MAX_PROCESSED_IDS / 2);
    toRemove.forEach(id => processedMessageIds.delete(id));
  }
};

export const useGlobalWebSocket = () => {
  const mountedRef = useRef(true);
  const initializedRef = useRef(false);

  useEffect(() => {
    // Prevent multiple initializations from React strict mode or re-renders
    if (initializedRef.current) {
      return;
    }
    initializedRef.current = true;
    mountedRef.current = true;

    const connect = () => {
      const token = getToken();

      if (!token) {
        console.warn('[GlobalWS] Skipped: no token');
        return;
      }

      // CRITICAL: Check if socket already exists and is open/connecting
      if (globalWsInstance) {
        const state = globalWsInstance.readyState;
        if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {
          console.log('[GlobalWS] Already connected or connecting — skipping');
          return;
        }
        // Socket exists but is closing/closed — clean it up
        globalWsInstance = null;
      }

      cachedCurrentUserId = token ? String(decodeToken(token)?.user_id) : undefined;

      console.log('[GlobalWS] CREATED — establishing connection');
      const socket = new WebSocket(getWsUrl());
      globalWsInstance = socket;

      socket.onopen = () => {
        console.log('[GlobalWS] CONNECTED');
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

          // For message events, deduplicate by message ID
          if (
            eventType === 'NEW_MESSAGE' ||
            eventType === 'FORWARDED_MESSAGE' ||
            eventType === 'MESSAGE'
          ) {
            const msgId = String(messageObj?.id || data.id || '');
            if (msgId && processedMessageIds.has(`global_${msgId}`)) {
              // Already processed this message in global socket — skip
              return;
            }
            if (msgId) {
              processedMessageIds.add(`global_${msgId}`);
              cleanupProcessedIds();
            }

            const normalizedPayload = {
              ...data,
              last_message: messageObj,
              conversation_id: effectiveChatId
            };
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
            const currentUserId = usePresenceStore.getState().currentUserId;
            
            console.log('[GlobalWS] Presence update received:', { user_id, status, currentUserId });
            
            // CRITICAL: Ignore presence updates for the CURRENT user.
            // Your own presence is managed by the toggle + API, not by WebSocket broadcasts.
            // Without this, WebSocket events can override your toggle state due to race conditions.
            if (currentUserId && String(user_id) === String(currentUserId)) {
              console.log('[GlobalWS] IGNORING presence update for self');
              return;
            }
            
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

      socket.onerror = (err) => {
        console.error('[GlobalWS] Error:', err);
      };

      socket.onclose = (event) => {
        console.log('[GlobalWS] CLOSED — code:', event.code);
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
          if (mountedRef.current) {
            connect();
          }
        }, delay);
      };
    };

    connect();

    // Set up visibility change handler (only once)
    if (!globalWsVisibilityHandler && typeof window !== 'undefined') {
      globalWsVisibilityHandler = () => {
        if (document.visibilityState === 'visible') {
          if (!globalWsInstance || globalWsInstance.readyState !== WebSocket.OPEN) {
            console.log('[GlobalWS] Visibility change — reconnecting');
            connect();
          }
        }
      };
      document.addEventListener('visibilitychange', globalWsVisibilityHandler);
    }

    return () => {
      mountedRef.current = false;
      initializedRef.current = false;
      if (globalWsReconnectTimeout) {
        clearTimeout(globalWsReconnectTimeout);
        globalWsReconnectTimeout = null;
      }
      // Do NOT close the global socket on unmount — it's shared across the app
    };
  }, []);
};