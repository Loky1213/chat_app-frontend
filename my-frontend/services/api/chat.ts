import { apiClient } from '@/services/apiClient';
import { Conversation, Message, User } from '@/types/chat';

export const chatApi = {
  // Existing: Get all conversations for the sidebar
  getConversations: async (): Promise<Conversation[]> => {
    const res = await apiClient.get('/api/chat/conversations/');
    return res.data.data || res.data;
  },

  // Existing: Get paginated messages for a conversation (cursor-based)
  getMessages: async (conversationId: string): Promise<{
    data: Message[];
    next: string | null;
  }> => {
    const res = await apiClient.get(`/api/chat/conversations/${conversationId}/messages/`);
    const responseData = res.data;
    
    // Handle different response formats
    const messages = Array.isArray(responseData) 
      ? responseData 
      : (responseData?.data || responseData?.results || []);
    
    return {
      data: messages,
      next: responseData?.next || null,
    };
  },

  // Fetch older messages using cursor URL
  getOlderMessages: async (cursorUrl: string): Promise<{
    data: Message[];
    next: string | null;
  }> => {
    const res = await apiClient.get(cursorUrl);
    const responseData = res.data;
    
    const messages = Array.isArray(responseData)
      ? responseData
      : (responseData?.data || responseData?.results || []);
    
    return {
      data: messages,
      next: responseData?.next || null,
    };
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

  getMyPresence: async (): Promise<{ is_online: boolean; is_visible: boolean }> => {
    const res = await apiClient.get('/api/chat/presence/me/');
    return res.data;
  },

  togglePresence: async (isVisible: boolean): Promise<{ is_visible: boolean }> => {
    const res = await apiClient.patch('/api/chat/presence/toggle/', { is_visible: isVisible });
    return res.data;
  },

  // Read Receipts API
  toggleReadReceipts: async (is_enabled: boolean) => {
    if (typeof is_enabled !== 'boolean') {
      throw new Error('is_enabled must be boolean');
    }
    const res = await apiClient.patch('/api/chat/read-receipts/', { is_enabled });
    return res.data; // { is_enabled: boolean }
  },
};
