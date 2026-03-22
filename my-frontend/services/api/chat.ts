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

  // NEW: Fetch all available users to start a chat with
  getUsers: async (): Promise<User[]> => {
    const res = await apiClient.get('/api/user/users/');
    // Assuming backend returns { success: true, data: [...] } or just the array
    return res.data.data || res.data; 
  },

  // NEW: Create a private chat with a specific user
  createPrivateChat: async (userId: number): Promise<{ conversation_id: string }> => {
    const res = await apiClient.post('/api/chat/private/create/', { user_id: userId });
    // Assuming backend returns { success: true, data: { conversation_id: "..." } }
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
  }
};
