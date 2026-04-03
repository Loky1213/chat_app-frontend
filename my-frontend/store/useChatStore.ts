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
  readReceiptsUserIds: number[];
  typingUsers: Record<string, NodeJS.Timeout>;

  setConversations: (conversations: Conversation[]) => void;
  setActiveConversationId: (id: string | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  removeMessage: (messageId: string) => void;
  addReadReceipt: (userId: number, messageId?: string) => void;
  setTyping: (userId: string) => void;
  setSocket: (socket: WebSocket | null) => void;
  resetChat: () => void;
  fetchConversations: () => Promise<void>;
  fetchMessages: (conversationId: string) => Promise<void>;
  updateMessageReactions: (messageId: string, reactions: { emoji: string; count: number; user_reacted: boolean }[]) => void;
  updateConversationOnSend: (message: any) => void;
  handleIncomingMessage: (payload: any, currentUserId?: string | number) => void;
  handleUnreadReset: (chatId: string) => void;
}

function moveConversationToTop(
  conversations: Conversation[],
  conversationId: string,
  updates: Partial<Conversation>
): Conversation[] | null {
  const copy = [...conversations];
  const index = copy.findIndex(c => String(c.id) === String(conversationId));
  if (index === -1) return null;
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
    messages: [],
    // FIX: clear readReceiptsUserIds on every conversation switch.
    // Without this, receipts from the previous conversation bleed into
    // the new one and every message shows a blue double-tick immediately.
    readReceiptsUserIds: [],
    typingUsers: {},
    conversations: state.conversations.map(conv =>
      String(conv.id) === String(id) ? { ...conv, unread_count: 0 } : conv
    )
  })),

  setMessages: (messages) => set((state) => {
    const normalized = normalizeMessages(messages);
    const uniqueMessagesMap = new Map<string, Message>();
    // FIX: normalise ID to string before using as Map key — prevents
    // numeric-vs-string key collisions that allow duplicate entries.
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

    return {
      messages: uniqueMessages,
      conversations: updatedConversations,
      conversationIds: updatedConversations.map(c => String(c.id))
    };
  }),

  addMessage: (newMessage) => set((state) => {
    const safe = normalizeMessage(newMessage);

    if (safe.message_type === 'system' || safe.message_type === 'group_event') {
      setTimeout(() => get().fetchConversations(), 0);
    }

    // FIX: always compare as strings — the same message ID may arrive as
    // number from chat_message and as string from new_message (or vice versa),
    // which previously bypassed the dedup check and inserted it twice.
    if (state.messages.some(m => String(m.id) === String(safe.id))) {
      return state; // already in store — do nothing
    }

    const updatedMessages = [...state.messages, safe]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    return { messages: updatedMessages };
  }),

  updateMessage: (messageId, updates) => set((state) => ({
    messages: state.messages.map(m =>
      String(m.id) === String(messageId) ? { ...m, ...updates } : m
    )
  })),

  removeMessage: (messageId) => set((state) => ({
    messages: state.messages.filter(m => String(m.id) !== String(messageId))
  })),

  addReadReceipt: (userId, messageId) => set((state) => {
    // FIX: When a read receipt arrives, update the specific message's read_by array.
    // If no messageId is provided, mark ALL messages in the current conversation as read.
    const userIdStr = String(userId);
    
    const updatedMessages = state.messages.map(m => {
      // If messageId is provided, only update that specific message
      if (messageId && String(m.id) !== String(messageId)) {
        return m;
      }
      
      // Skip if already recorded (normalize to string for comparison)
      const existingReadBy = m.read_by || [];
      if (existingReadBy.some(id => String(id) === userIdStr)) {
        return m;
      }
      
      return { ...m, read_by: [...existingReadBy, userId] };
    });

    return {
      readReceiptsUserIds: [...new Set([...state.readReceiptsUserIds, userId])],
      messages: updatedMessages
    };
  }),

  setTyping: (userId: string) => set((state) => {
    const key = String(userId);
    const existingTimeout = state.typingUsers[key];
    if (existingTimeout) clearTimeout(existingTimeout);

    const timeout = setTimeout(() => {
      set((s) => {
        const updated = { ...s.typingUsers };
        delete updated[key];
        return { typingUsers: updated };
      });
    }, 4000);

    return { typingUsers: { ...state.typingUsers, [key]: timeout } };
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

  updateConversationOnSend: (message) => set((state) => {
    const convId = String(message.conversation_id);
    const existing = state.conversations.find(c => String(c.id) === convId);
    if (existing?.last_message && String(existing.last_message.id) === String(message.id)) {
      return state;
    }
    const result = moveConversationToTop(state.conversations, convId, {
      last_message: { ...message },
    });
    if (!result) return state;
    return { conversations: result, conversationIds: result.map(c => String(c.id)) };
  }),

  handleUnreadReset: (chatId: string) => set((state) => {
    const existing = state.conversations.find(c => String(c.id) === String(chatId));
    if (!existing || !existing.unread_count || existing.unread_count === 0) return state;

    const updatedConversations = state.conversations.map(c =>
      String(c.id) === String(chatId) ? { ...c, unread_count: 0 } : c
    );
    return { conversations: updatedConversations, conversationIds: state.conversationIds };
  }),

  // The global socket updates the sidebar only — does NOT touch state.messages.
  // The chat-scoped socket (useChatWebSocket) owns state.messages via addMessage.
  handleIncomingMessage: (payload: any, currentUserId?: string | number) => set((state) => {
    if (!payload.last_message && !payload.message && !payload.id) return state;

    const rawMsg = payload.last_message || payload.message || payload;
    const msg: Message = normalizeMessage(rawMsg);

    if (msg.message_type === 'system' || msg.message_type === 'group_event') {
      setTimeout(() => get().fetchConversations(), 0);
    }

    const senderId = msg.sender?.id ?? rawMsg.sender_id;
    const isMine = currentUserId ? String(senderId) === String(currentUserId) : false;

    const chatId = String(
      (msg as any).conversation_id ||
      rawMsg.chat_id ||
      payload.conversation_id ||
      rawMsg.conversation_id
    );
    const isChatOpen = String(state.activeConversationId) === chatId;

    const existing = state.conversations.find(c => String(c.id) === chatId);
    if (!existing) {
      setTimeout(() => get().fetchConversations(), 0);
      return state;
    }

    const newUnread = !isMine && !isChatOpen
      ? (existing.unread_count || 0) + 1
      : (isChatOpen ? 0 : existing.unread_count);

    const updatedChat: Conversation = {
      ...existing,
      last_message: { ...msg },
      unread_count: newUnread
    };

    const filteredConversations = state.conversations.filter(c => String(c.id) !== chatId);
    const newConversations = [updatedChat, ...filteredConversations];

    // NOTE: state.messages is intentionally NOT modified here.
    // Only the sidebar (conversations list) is updated by the global socket.
    return {
      conversations: newConversations,
      conversationIds: newConversations.map(c => String(c.id))
    };
  }),
}));