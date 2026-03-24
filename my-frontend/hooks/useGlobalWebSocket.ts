import { useEffect, useRef } from 'react';
import { useChatStore } from '@/store/useChatStore';

export const useGlobalWebSocket = () => {
  const { handleGlobalNewMessage } = useChatStore();
  const ws = useRef<WebSocket | null>(null);
  const disconnectTime = useRef<number | null>(null);

  const getWsUrl = () => {
    const baseWbUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
    return `${baseWbUrl}/ws/notifications/?token=${token}`;
  };

  useEffect(() => {
    let reconnectTimeoutId: NodeJS.Timeout;

    const connect = () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      if (!token) {
        console.warn('Cannot connect to Global WebSocket: No access_token');
        return;
      }

      console.log('Connecting Global WebSocket...');
      const url = getWsUrl();
      const socket = new WebSocket(url);

      socket.onopen = () => {
        console.log('Global WebSocket Connected');
        const state = useChatStore.getState();
        
        let shouldRefetch = state.conversations.length === 0;
        
        if (disconnectTime.current) {
          const duration = Date.now() - disconnectTime.current;
          if (duration > 5000) { // 5 seconds threshold
            shouldRefetch = true;
          }
          disconnectTime.current = null;
        }

        // 2. Optimize reconnect behavior: refetch if empty or stale
        if (shouldRefetch) {
          state.fetchConversations();
          // Also optionally refetch active chat messages to ensure consistency
          if (state.activeConversationId && state.fetchMessages) {
            state.fetchMessages(state.activeConversationId);
          }
        }
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'new_message') {
            handleGlobalNewMessage(data);
          }
        } catch (err) {
          console.error('Error parsing global WS message:', err);
        }
      };

      socket.onerror = (error) => {
        console.error('Global WebSocket Error:', error);
      };

      socket.onclose = () => {
        console.log('Global WebSocket Disconnected. Rescheduling connection...');
        if (!disconnectTime.current) {
          disconnectTime.current = Date.now();
        }
        reconnectTimeoutId = setTimeout(connect, 3000);
      };

      ws.current = socket;
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeoutId);
      if (ws.current) {
        ws.current.onclose = null; // Prevent auto-reconnect on teardown
        ws.current.close();
        ws.current = null;
      }
    };
  }, [handleGlobalNewMessage]);
};
