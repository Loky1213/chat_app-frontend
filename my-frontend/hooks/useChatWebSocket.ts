import { useEffect, useRef, useCallback } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { Message } from '@/types/chat';

export const useChatWebSocket = (conversationId: string | null) => {
  const { addMessage, addReadReceipt, setSocket } = useChatStore();
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
          if (data.type === 'message') {
            const newMessage: Message = data.data;
            addMessage(newMessage);
          } else if (data.type === 'read_receipt') {
            const userIdMapping = Number(data.user_id);
            addReadReceipt(userIdMapping);
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
  }, [conversationId, addMessage, addReadReceipt, setSocket]);

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

  const sendReadReceipt = useCallback(() => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        action: 'mark_read'
      }));
    }
  }, []);

  return { sendMessage, sendReadReceipt, socketReadyState: ws.current?.readyState };
};
