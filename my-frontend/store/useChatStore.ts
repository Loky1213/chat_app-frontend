import { create } from 'zustand';
import { Conversation, Message } from '@/types/chat';
import { chatApi } from '@/services/api/chat';
import { normalizeMessage, normalizeMessages } from '@/lib/normalizeMessage';

interface ChatState {
  conversations: Conversation[];
  conversationIds: string[];
  activeConversationId: string | null;
  messages: Message[];
  socket: WebSocket | null;
  readReceiptsUserIds: number[]; // User IDs that marked the active conversation as read
  typingUsers: Record<string, NodeJS.Timeout>; // mapped by user_id string to timeout

  setConversations: (conversations: Conversation[]) => void;
  setActiveConversationId: (id: string | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  removeMessage: (messageId: string) => void;
  addReadReceipt: (userId: number, messageId?: string) => void;
  setTyping: (userId: number) => void;
  setSocket: (socket: WebSocket | null) => void;
  resetChat: () => void;
  fetchConversations: () => Promise<void>;
  fetchMessages: (conversationId: string) => Promise<void>;
  updateMessageReactions: (messageId: string, reactions: { emoji: string; count: number; user_reacted: boolean }[]) => void;
  updateConversationOnSend: (message: any) => void;
  handleIncomingMessage: (payload: any, currentUserId?: string | number) => void;
  handleUnreadReset: (chatId: string) => void;
}

// ─── Centralized O(1) conversation repositioning ───
// Finds the conversation by ID, updates it, and moves it to the top.
// Returns a NEW array (immutable). Returns null if conversation not found.
function moveConversationToTop(
  conversations: Conversation[],
  conversationId: string,
  updates: Partial<Conversation>
): Conversation[] | null {
  const copy = [...conversations];
  const index = copy.findIndex(c => String(c.id) === String(conversationId));
  if (index === -1) return null;

  // Splice out, apply updates, unshift to top — O(1) repositioning
  const [conv] = copy.splice(index, 1);
  copy.unshift({ ...conv, ...updates });
  return copy;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  conversationIds: [],
  activeConversationId: null,
  messages: [],
  socket: null,
  readReceiptsUserIds: [],
  typingUsers: {},

  setConversations: (conversations) => {
    const uniqueMap = new Map<string, Conversation>();

    (conversations || []).forEach(conv => {
      const isPrivate = !conv.name && conv.participants.length <= 2;
      const key = isPrivate
        ? 'private_' + conv.participants.map(p => String(p.id)).sort().join('_')
        : String(conv.id);
      uniqueMap.set(key, conv);
    });

    const newConversations = Array.from(uniqueMap.values());
    set({
      conversations: newConversations,
      conversationIds: newConversations.map(c => String(c.id))
    });
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
    // Normalize ALL messages before storing
    const normalized = normalizeMessages(messages);

    // Use Map to ensure absolute duplicate prevention from multiple sources
    const uniqueMessagesMap = new Map();
    normalized.forEach(m => uniqueMessagesMap.set(String(m.id), m));
    const uniqueMessages = Array.from(uniqueMessagesMap.values());

    const updatedConversations = state.conversations.map(conv => {
      if (String(conv.id) === String(state.activeConversationId)) {
        return {
          ...conv,
          last_message: uniqueMessages.length > 0 
            ? { ...uniqueMessages[uniqueMessages.length - 1] } 
            : (conv.last_message ? { ...conv.last_message } : undefined),
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
      conversations: updatedConversations,
      conversationIds: updatedConversations.map(c => String(c.id))
    };
  }),

  addMessage: (newMessage) => set((state) => {
    // Normalize before storing — guarantees sender.id exists
    const safe = normalizeMessage(newMessage);

    if (safe.message_type === 'system' || safe.message_type === 'group_event') {
      setTimeout(() => get().fetchConversations(), 0);
    }

    // Prevent duplicate messages
    if (state.messages.some(m => String(m.id) === String(safe.id))) {
      return state;
    }

    const updatedMessages = [...state.messages, safe]
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

  updateMessageReactions: (messageId, reactions) => set((state) => ({
    messages: state.messages.map(m =>
      String(m.id) === String(messageId) ? { ...m, reactions } : m
    )
  })),

  // ─── Optimistic sender-side update (used by sendMessage + forwardMessage) ───
  updateConversationOnSend: (message) => set((state) => {
    const convId = String(message.conversation_id);

    // Deduplication: skip if last_message already matches
    const existing = state.conversations.find(c => String(c.id) === convId);
    if (existing?.last_message && String(existing.last_message.id) === String(message.id)) {
      return state;
    }

    const result = moveConversationToTop(state.conversations, convId, {
      last_message: { ...message },
    });

    if (!result) {
      console.log('[Store] updateConversationOnSend: conversation not found:', convId);
      return state;
    }

    console.log('[Store] updateConversationOnSend: moved conversation to top:', convId);
    return { 
      conversations: result,
      conversationIds: result.map(c => String(c.id)) 
    };
  }),

  updateConversation: (message: Message) => set((state) => {
    const convId = String((message as any).conversation_id);
    const updatedConversations = moveConversationToTop(state.conversations, convId, {
      last_message: { ...message },
      // If there is an updated_at field expected from backend, we could add it, but it isn't part of Conversation strictly right now.
    });

    if (!updatedConversations) return state;
    return { 
      conversations: updatedConversations,
      conversationIds: updatedConversations.map(c => String(c.id))
    };
  }),

  // ─── Handle WebSocket events: new_message + forwarded_message ───
  // Each call processes ONE event for ONE conversation_id.
  // Uses functional set() so rapid multi-forward events never read stale state.
  incrementUnread: (chatId: string) => set((state) => {
    // Determine if the chat is open
    const isChatOpen = String(state.activeConversationId) === String(chatId);
    
    // Use functional mapping without overwriting completely
    return {
      conversations: state.conversations.map(c => {
        if (String(c.id) === String(chatId)) {
          return {
            ...c,
            unread_count: isChatOpen ? 0 : (c.unread_count || 0) + 1
          };
        }
        return c;
      })
    };
  }),

  handleUnreadReset: (chatId: string) => set((state) => {
    const existing = state.conversations.find(c => String(c.id) === String(chatId));
    
    // IGNORE REDUNDANT EVENTS
    if (!existing || !existing.unread_count || existing.unread_count === 0) {
      return state;
    }

    const updatedConversations = state.conversations.map(c => 
      String(c.id) === String(chatId) ? { ...c, unread_count: 0 } : c
    );

    return { 
      conversations: updatedConversations,
      conversationIds: state.conversationIds
    };
  }),

  handleIncomingMessage: (payload: any, currentUserId?: string | number) => set((state) => {
    // Prevent unparseable payloads
    if (!payload.last_message && !payload.message && !payload.id) {
      console.warn('[Store] Ignoring event: no valid message payload');
      return state;
    }

    // Normalize safely to intercept discrepancies across REST/Socket interfaces
    const rawMsg = payload.last_message || payload.message || payload;
    const msg: Message = normalizeMessage(rawMsg);
    
    // Automatically refetch group metadata if a system event passes through the chat stream
    if (msg.message_type === 'system' || msg.message_type === 'group_event') {
      console.log('[Store] System message detected, syncing conversations in background');
      setTimeout(() => get().fetchConversations(), 0);
    }
    
    // Extract senderId safely
    const senderId = msg.sender?.id ?? rawMsg.sender_id;
    
    // Determine ownership safely
    const isMine = currentUserId ? String(senderId) === String(currentUserId) : false;
    
    // Determine if chat is open safely
    const chatId = String((msg as any).conversation_id || rawMsg.chat_id || payload.conversation_id || rawMsg.conversation_id);
    const isChatOpen = String(state.activeConversationId) === chatId;

    // Find existing conversation
    const existing = state.conversations.find(c => String(c.id) === chatId);
    if (!existing) {
      // Background re-sync triggered if native socket intercepts unregistered topology
      console.log('[Store] Conversation not found locally, fetching from server:', chatId);
      setTimeout(() => get().fetchConversations(), 0);
      return state; // Prevent crash, rely on fetch hook
    }

    // Verification trace 
    console.log("DEBUG:", {
      senderId,
      currentUserId: currentUserId,
      isMine,
      chatId: chatId,
      activeConversationId: state.activeConversationId
    });

    // Compute unread_count safely targeting the strict state flags
    const newUnread = !isMine && !isChatOpen 
      ? (existing.unread_count || 0) + 1 
      : (isChatOpen ? 0 : existing.unread_count);

    // Build the updated object map tracking pure metadata
    // FORCE NEW OBJECT REFERENCES
    const updatedChat: Conversation = {
      ...existing,
      last_message: { ...msg },
      unread_count: newUnread
    };

    // Immutably move to top strictly over array spreads
    const filteredConversations = state.conversations.filter(c => String(c.id) !== chatId);

    // Target the absolute message container correctly
    let finalMessages = state.messages;
    if (isChatOpen) {
      // Assure strict deduplication over messages list bounds
      if (!state.messages.some(m => String(m.id) === String(msg.id))) {
        finalMessages = [...state.messages, msg].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      }
    }

    const newConversations = [updatedChat, ...filteredConversations];
    return {
      messages: finalMessages,
      conversations: newConversations,
      conversationIds: newConversations.map(c => String(c.id))
    };
  }),
}));
