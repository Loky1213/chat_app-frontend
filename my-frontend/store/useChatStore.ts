import { create } from 'zustand';
import { Conversation, Message } from '@/types/chat';

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Message[];
  socket: WebSocket | null;
  readReceiptsUserIds: number[]; // User IDs that marked the active conversation as read
  
  setConversations: (conversations: Conversation[]) => void;
  setActiveConversationId: (id: string | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  addReadReceipt: (userId: number) => void;
  setSocket: (socket: WebSocket | null) => void;
  resetChat: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  socket: null,
  readReceiptsUserIds: [],
  
  setConversations: (conversations) => {
    const uniqueMap = new Map<string, Conversation>();
    (conversations || []).forEach(conv => {
      const isPrivate = !conv.name && conv.participants.length <= 2;
      const key = isPrivate 
        ? 'private_' + conv.participants.map(p => String(p.id)).sort().join('_') 
        : String(conv.id);
      uniqueMap.set(key, conv);
    });
    set({ conversations: Array.from(uniqueMap.values()) });
  },
  
  setActiveConversationId: (id) => set({ 
    activeConversationId: id,
    messages: [], // Clear messages when switching
    readReceiptsUserIds: [], // Clear read receipts when switching
  }),
  
  setMessages: (messages) => set({ messages }),
  
  addMessage: (newMessage) => set((state) => ({ 
    messages: state.messages.some(m => m.id === newMessage.id)
      ? state.messages
      : [...state.messages, newMessage]
  })),
  
  addReadReceipt: (userId) => set((state) => ({
    readReceiptsUserIds: [...new Set([...state.readReceiptsUserIds, userId])]
  })),
  
  setSocket: (socket) => set({ socket }),
  
  resetChat: () => set({ 
    activeConversationId: null, 
    messages: [], 
    readReceiptsUserIds: [],
    socket: null 
  }),
}));
