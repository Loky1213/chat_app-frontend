import { create } from 'zustand';
import { Conversation, Message } from '@/types/chat';
import { chatApi } from '@/services/api/chat';

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Message[];
  socket: WebSocket | null;
  readReceiptsUserIds: number[]; // User IDs that marked the active conversation as read
  onlineUsers: number[];
  typingUsers: Record<string, NodeJS.Timeout>; // mapped by user_id string to timeout
  
  setConversations: (conversations: Conversation[]) => void;
  setActiveConversationId: (id: string | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  removeMessage: (messageId: string) => void;
  addReadReceipt: (userId: number, messageId?: string) => void;
  setOnline: (userId: number) => void;
  setOffline: (userId: number) => void;
  setTyping: (userId: number) => void;
  setSocket: (socket: WebSocket | null) => void;
  resetChat: () => void;
  fetchConversations: () => Promise<void>;
  fetchMessages: (conversationId: string) => Promise<void>;
  handleGlobalNewMessage: (payload: any) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  socket: null,
  readReceiptsUserIds: [],
  onlineUsers: [],
  typingUsers: {},
  
  setConversations: (conversations) => {
    const uniqueMap = new Map<string, Conversation>();
    const initialOnlineUsers = new Set<number>();
    
    (conversations || []).forEach(conv => {
      const isPrivate = !conv.name && conv.participants.length <= 2;
      const key = isPrivate 
        ? 'private_' + conv.participants.map(p => String(p.id)).sort().join('_') 
        : String(conv.id);
      uniqueMap.set(key, conv);

      // Extract initial online users
      conv.participants.forEach(p => {
        if (p.is_online) {
          initialOnlineUsers.add(p.id);
        }
      });
    });
    
    set((state) => ({ 
      conversations: Array.from(uniqueMap.values()),
      onlineUsers: Array.from(new Set([...state.onlineUsers, ...initialOnlineUsers]))
    }));
  },
  
  setActiveConversationId: (id) => set((state) => ({ 
    activeConversationId: id,
    messages: [], // Clear messages when switching
    readReceiptsUserIds: [], // Clear read receipts when switching
    typingUsers: {}, // Clear typing users when switching
    conversations: state.conversations.map(conv => 
      conv.id === id ? { ...conv, unread_count: 0 } : conv
    )
  })),
  
  setMessages: (messages) => set((state) => {
    // Use Map to ensure absolute duplicate prevention from multiple sources
    const uniqueMessagesMap = new Map();
    messages.forEach(m => uniqueMessagesMap.set(String(m.id), m));
    const uniqueMessages = Array.from(uniqueMessagesMap.values());

    const updatedConversations = state.conversations.map(conv => {
      if (String(conv.id) === String(state.activeConversationId)) {
        return {
          ...conv,
          last_message: uniqueMessages.length > 0 ? uniqueMessages[uniqueMessages.length - 1] : conv.last_message,
        };
      }
      return conv;
    });
    
    updatedConversations.sort((a, b) => {
      const timeA = a.last_message?.created_at ? new Date(a.last_message.created_at).getTime() : 0;
      const timeB = b.last_message?.created_at ? new Date(b.last_message.created_at).getTime() : 0;
      return timeB - timeA;
    });

    return {
      messages: uniqueMessages,
      conversations: updatedConversations
    };
  }),
  
  addMessage: (newMessage) => set((state) => {
    // Prevent duplicate messages
    if (state.messages.some(m => String(m.id) === String(newMessage.id))) {
      return state;
    }

    const updatedMessages = [...state.messages, newMessage]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    return { 
      messages: updatedMessages 
    };
  }),

  updateMessage: (messageId, updates) => set((state) => ({
    messages: state.messages.map(m => 
      m.id === messageId ? { ...m, ...updates } : m
    )
  })),

  removeMessage: (messageId) => set((state) => ({
    messages: state.messages.filter(m => m.id !== messageId)
  })),
  
  addReadReceipt: (userId, messageId) => set((state) => {
    // If messageId is provided, also update the specific message's read_by array
    const updatedMessages = messageId ? state.messages.map(m => {
      if (m.id === messageId || (m.read_by && m.read_by.includes(userId))) {
        return m;
      }
      return { ...m, read_by: [...(m.read_by || []), userId] };
    }) : state.messages;

    return {
      readReceiptsUserIds: [...new Set([...state.readReceiptsUserIds, userId])],
      messages: updatedMessages
    };
  }),

  setOnline: (userId) => set((state) => ({
    onlineUsers: [...new Set([...state.onlineUsers, userId])]
  })),

  setOffline: (userId) => set((state) => ({
    onlineUsers: state.onlineUsers.filter(id => id !== userId)
  })),

  setTyping: (userId) => set((state) => {
    const existingTimeout = state.typingUsers[userId];
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(() => {
      set((s) => {
        const newTypingUsers = { ...s.typingUsers };
        delete newTypingUsers[userId];
        return { typingUsers: newTypingUsers };
      });
    }, 4000); // clear after 4 seconds

    return {
      typingUsers: {
        ...state.typingUsers,
        [userId]: timeout
      }
    };
  }),
  
  setSocket: (socket) => set({ socket }),
  
  resetChat: () => set({ 
    activeConversationId: null, 
    messages: [], 
    readReceiptsUserIds: [],
    onlineUsers: [],
    typingUsers: {},
    socket: null 
  }),

  fetchConversations: async () => {
    try {
      const data = await chatApi.getConversations();
      get().setConversations(data);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  },

  fetchMessages: async (conversationId: string) => {
    try {
      const data = await chatApi.getMessages(conversationId);
      const messagesArray = Array.isArray(data) ? data : [];
      get().setMessages([...messagesArray].reverse());
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  },

  handleGlobalNewMessage: (payload) => set((state) => {
    // 1. Enforce strict payload contract
    if (!payload.last_message) return state; // Ignore event if missing

    let conversationExists = false;
    const updatedConversations = state.conversations.map(conv => {
      if (String(conv.id) === String(payload.conversation_id)) {
        conversationExists = true;
        const isActiveChat = String(conv.id) === String(state.activeConversationId);
        
        const incomingTime = new Date(payload.last_message.created_at).getTime();
        const existingTime = conv.last_message ? new Date(conv.last_message.created_at).getTime() : 0;
        
        // 5. Ensure last_message consistency: Only update if incoming message is newer or equal
        if (incomingTime < existingTime) {
          return conv; 
        }

        // Use ONLY payload.last_message
        const newLastMessage = payload.last_message;
        
        // 3. Fix unread count edge cases: always 0 if active chat, no visibility check
        const newUnreadCount = isActiveChat 
          ? 0 
          : (payload.unread_count !== undefined ? payload.unread_count : conv.unread_count);

        return {
          ...conv,
          last_message: newLastMessage,
          unread_count: newUnreadCount,
        };
      }
      return conv;
    });

    if (!conversationExists) {
        // Asynchronously fetch missing conversations
        setTimeout(() => get().fetchConversations(), 0);
        return state;
    }

    updatedConversations.sort((a, b) => {
      const timeA = a.last_message?.created_at ? new Date(a.last_message.created_at).getTime() : 0;
      const timeB = b.last_message?.created_at ? new Date(b.last_message.created_at).getTime() : 0;
      return timeB - timeA;
    });

    return { conversations: updatedConversations };
  }),
}));
