'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useChatStore } from '@/store/useChatStore';
import { chatApi } from '@/services/api/chat';
import { ConversationList } from './ConversationList';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { useChatWebSocket } from '@/hooks/useChatWebSocket';
import { useAuth } from '@/context/AuthContext';

export const ChatContainer = () => {
  const { setConversations, activeConversationId, setMessages } = useChatStore();

  // Initialize Conversation List
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const data = await chatApi.getConversations();
        setConversations(data);
      } catch (error) {
        console.error('Failed to load conversations:', error);
      }
    };
    fetchConversations();
  }, [setConversations]);

  // Load Messages when Active Conversation Changes
  useEffect(() => {
    if (!activeConversationId) return;

    const fetchMessages = async () => {
      try {
        const data = await chatApi.getMessages(activeConversationId);
        // Step 6 handles DRF pagination array extraction upstream cleanly
        const messagesArray = Array.isArray(data) ? data : [];
        setMessages([...messagesArray].reverse()); // Reverse to show oldest first
      } catch (error) {
        console.error('Failed to load messages:', error);
      }
    };

    fetchMessages();
  }, [activeConversationId, setMessages]);


  return (
    <div className="flex h-screen bg-gray-100 font-sans text-gray-900 border overflow-hidden">
      {/* Sidebar: List of Conversations */}
      <ConversationList />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white shadow-xl z-10 relative border-l border-gray-200">
        <MessageList />
        <MessageInput />
      </div>
    </div>
  );
};
