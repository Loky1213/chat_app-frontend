import { apiClient } from '@/services/apiClient';
import { Conversation, Message, User } from '@/types/chat';

export const chatApi = {
  // Existing: Get all conversations for the sidebar
  getConversations: async (): Promise<Conversation[]> => {
    const res = await apiClient.get('/api/chat/conversations/');
    return res.data.data || res.data;
  },

  // Existing: Get paginated messages for a conversation
  getMessages: async (conversationId: string, page: number = 1) => {
    const res = await apiClient.get(`/api/chat/conversations/${conversationId}/messages/?page=${page}`);
    const data = res.data;
    return Array.isArray(data) ? data : (data?.data || data?.results || []);
  },

  // Existing: Mark a conversation as read
  markAsRead: async (conversationId: string): Promise<void> => {
    await apiClient.post(`/api/chat/conversations/${conversationId}/mark-read/`);
  },

  // Fetch all available users to start a chat with
  getUsers: async (): Promise<User[]> => {
    const res = await apiClient.get('/api/user/users/');
    return res.data.data || res.data; 
  },

  // Create a private chat with a specific user
  createPrivateChat: async (userId: number): Promise<{ conversation_id: string }> => {
    const res = await apiClient.post('/api/chat/private/create/', { user_id: userId });
    return res.data.data;
  },

  // Group Management APIs
  createGroupChat: async (name: string, userIds: number[]): Promise<{ conversation_id: string }> => {
    const res = await apiClient.post('/api/chat/group/create/', { name, user_ids: userIds });
    return res.data.data || res.data;
  },

  addMembers: async (conversationId: string, userIds: number[]) => {
    const res = await apiClient.post(`/api/chat/conversations/${conversationId}/add-members/`, { user_ids: userIds });
    return res.data;
  },

  removeMember: async (conversationId: string, userId: number) => {
    const res = await apiClient.delete(`/api/chat/conversations/${conversationId}/remove-member/${userId}/`);
    return res.data;
  },

  promoteAdmin: async (conversationId: string, userId: number) => {
    const res = await apiClient.post(`/api/chat/conversations/${conversationId}/promote-admin/`, { user_id: userId });
    return res.data;
  },

  removeAdmin: async (conversationId: string, userId: number) => {
    const res = await apiClient.post(`/api/chat/conversations/${conversationId}/remove-admin/`, { user_id: userId });
    return res.data;
  },

  // Forward Messages
  forwardMessage: async (messageId: number, targetConversationIds: number[]): Promise<any> => {
    const payload = {
      message_id: Number(messageId),
      target_ids: targetConversationIds.map(Number)
    };
    const res = await apiClient.post('/api/chat/messages/forward/', payload);
    return res.data;
  },

  // Presence APIs
  getOnlineUsers: async (): Promise<string[]> => {
    const res = await apiClient.get('/api/chat/presence/online-users/');
    return res.data.online_users;
  },

  getMyPresence: async (): Promise<{ is_online: boolean; is_hidden: boolean }> => {
    const res = await apiClient.get('/api/chat/presence/me/');
    return res.data;
  },

  toggleHideOnline: async (hideOnline: boolean) => {
    const res = await apiClient.post('/api/chat/presence/toggle/', { hide_online: hideOnline });
    return res.data;
  },
};
