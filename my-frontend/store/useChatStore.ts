import { create } from 'zustand';
import { Conversation, Message } from '@/types/chat';

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
}

export const useChatStore = create<ChatState>((set) => ({
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
    // Also patch the snippet in the sidebar for the active chat
    const updatedConversations = state.conversations.map(conv => {
      if (String(conv.id) === String(state.activeConversationId)) {
        return {
          ...conv,
          last_message: messages.length > 0 ? messages[messages.length - 1] : conv.last_message,
        };
      }
      return conv;
    });
    
    // Dynamically Re-sort so active conversations instantly jump to the top
    updatedConversations.sort((a, b) => {
      const timeA = a.last_message?.created_at ? new Date(a.last_message.created_at).getTime() : 0;
      const timeB = b.last_message?.created_at ? new Date(b.last_message.created_at).getTime() : 0;
      return timeB - timeA;
    });

    return {
      messages,
      conversations: updatedConversations
    };
  }),
  
  addMessage: (newMessage) => set((state) => {
    // Prevent duplicate messages
    if (state.messages.some(m => m.id === newMessage.id)) {
      return state;
    }

    // Update the conversation's last_message in the sidebar
    const updatedConversations = state.conversations.map(conv => {
      // Determine if the message belongs to this conversation
      // We assume if it's the active chat, it goes there. Otherwise we'd need conversation_id on the message.
      // Use String() mapping to avoid number vs string type equality mismatches
      if (String(conv.id) === String(state.activeConversationId)) {
        return {
          ...conv,
          last_message: newMessage, // Assuming structural compatibility
        };
      }
      return conv;
    });

    // Dynamically Re-sort so active conversations instantly jump to the top
    updatedConversations.sort((a, b) => {
      const timeA = a.last_message?.created_at ? new Date(a.last_message.created_at).getTime() : 0;
      const timeB = b.last_message?.created_at ? new Date(b.last_message.created_at).getTime() : 0;
      return timeB - timeA;
    });

    return { 
      messages: [...state.messages, newMessage],
      conversations: updatedConversations
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
}));
