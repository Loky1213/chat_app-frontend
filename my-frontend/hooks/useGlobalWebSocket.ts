import { useEffect, useRef } from 'react';
import { useChatStore } from '@/store/useChatStore';

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

          if (data.type === 'new_message') {
            useChatStore.getState().handleGlobalNewMessage(data);
          }

          // 🔥 Optional: handle presence
          if (data.type === 'presence_update') {
            const { user_id, status } = data;
            const store = useChatStore.getState();

            if (status === 'user_online') {
              store.setOnline?.(user_id);
            } else if (status === 'user_offline') {
              store.setOffline?.(user_id);
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






// import { useEffect, useRef } from 'react';
// import { useChatStore } from '@/store/useChatStore';

// let globalWsInstance: WebSocket | null = null;
// let globalWsRetryCount = 0;
// let globalWsReconnectTimeout: NodeJS.Timeout | null = null;
// let globalWsVisibilityListenerAdded = false;

// export const useGlobalWebSocket = () => {
//   const { handleGlobalNewMessage } = useChatStore();
//   const mounted = useRef(true);

//   const getWsUrl = () => {
//     const baseWbUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://127.0.0.1:8000';
//     const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
//     return `${baseWbUrl}/ws/notifications/?token=${token}`;
//   };

//   useEffect(() => {
//     mounted.current = true;

//     const connect = () => {
//       const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
//       if (!token) return;

//       if (globalWsInstance) return;

//       console.log('WS INIT');
//       const url = getWsUrl();
//       const socket = new WebSocket(url);
//       globalWsInstance = socket;

//       socket.onopen = () => {
//         console.log('WS OPEN');
//         globalWsRetryCount = 0;

//         const state = useChatStore.getState();
//         let shouldRefetch = state.conversations.length === 0;
        
//         // 2. Optimize reconnect behavior: refetch if empty or stale
//         if (shouldRefetch) {
//           state.fetchConversations();
//           if (state.activeConversationId && state.fetchMessages) {
//             state.fetchMessages(state.activeConversationId);
//           }
//         }
//       };

//       socket.onmessage = (event) => {
//         try {
//           const data = JSON.parse(event.data);
//           if (data.type === 'new_message') {
//             useChatStore.getState().handleGlobalNewMessage(data);
//           }
//         } catch (err) {
//           console.error('Error parsing global WS message:', err);
//         }
//       };

//       socket.onerror = () => {
//         console.warn('WS ERROR (expected sometimes)');
//       };

//       socket.onclose = (event) => {
//         console.log('WS CLOSED:', event.code, event.reason);
//         globalWsInstance = null;

//         if (event.code === 1008) {
//           console.warn('Backend rejected auth token');
//           return;
//         }

//         const delay = Math.min(1000 * Math.pow(2, globalWsRetryCount), 10000);
//         globalWsRetryCount++;
        
//         if (globalWsReconnectTimeout) clearTimeout(globalWsReconnectTimeout);
//         globalWsReconnectTimeout = setTimeout(() => {
//           if (mounted.current) connect();
//         }, delay);
//       };
//     };

//     connect();

//     const handleVisibilityChange = () => {
//       if (document.visibilityState === 'visible') {
//         if (!globalWsInstance || globalWsInstance.readyState !== WebSocket.OPEN) {
//           connect();
//         }
//       }
//     };

//     if (!globalWsVisibilityListenerAdded && typeof window !== 'undefined') {
//       document.addEventListener('visibilitychange', handleVisibilityChange);
//       globalWsVisibilityListenerAdded = true;
//     }

//     return () => {
//       mounted.current = false;
//       if (globalWsReconnectTimeout) clearTimeout(globalWsReconnectTimeout);
//       if (globalWsInstance) {
//         globalWsInstance.onclose = null; // Prevent auto-reconnect on teardown
//         globalWsInstance.close();
//         globalWsInstance = null;
//       }
//     };
//   }, []); // Run effect only once on mount
// };
