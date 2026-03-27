'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useChatStore } from '@/store/useChatStore';
import { chatApi } from '@/services/api/chat';
import { Message } from '@/types/chat';
import { ConversationList } from './ConversationList';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { GroupManagement } from './GroupManagement';
import { useChatWebSocket } from '@/hooks/useChatWebSocket';
import { useGlobalWebSocket } from '@/hooks/useGlobalWebSocket';
import { useAuth } from '@/context/AuthContext';
import { Info } from 'lucide-react';

export const ChatContainer = () => {
  const { conversations, fetchConversations, activeConversationId, setMessages, onlineUsers } = useChatStore();
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const { user: currentUser } = useAuth();
  const { sendMessage, sendDeleteMessage, sendTyping, sendReadReceipt, sendReaction } = useChatWebSocket(activeConversationId);
  const [replyMessage, setReplyMessage] = useState<Message | null>(null);
  useGlobalWebSocket(); // Initialize global websocket connection for sidebar reordering

  const activeConversation = conversations.find(c => c.id === activeConversationId);

  const isPrivateChat = activeConversation && activeConversation.participants.length <= 2 && !activeConversation.name;
  const otherParticipant = isPrivateChat ? activeConversation.participants.find(p => String(p.id) !== String(currentUser?.id)) : null;
  const isOnline = otherParticipant ? !!onlineUsers[otherParticipant.id] : false;

  // Initialize Conversation List
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

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
        {activeConversation && (
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white shadow-sm z-10">
            <div>
              <h2 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                {activeConversation.name || activeConversation.participants.filter(p => String(p.id) !== String(currentUser?.id)).map(p => p.username).join(', ') || 'Chat'}
              </h2>
              {activeConversation.participants.length > 2 ? (
                <div className="text-xs text-gray-500">{activeConversation.participants.length} participants</div>
              ) : (
                isOnline && <div className="text-xs text-green-500 font-medium">Online</div>
              )}
            </div>
            {/* Show Info button ONLY for group chats */}
            {(activeConversation.participants.length > 2 || activeConversation.name) && (
              <button
                onClick={() => setShowGroupInfo(true)}
                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                title="Group Info"
              >
                <Info size={20} />
              </button>
            )}
          </div>
        )}

        <MessageList sendReadReceipt={sendReadReceipt} sendDeleteMessage={sendDeleteMessage} onReply={setReplyMessage} sendReaction={sendReaction} />
        <MessageInput sendMessage={sendMessage} sendTyping={sendTyping} replyMessage={replyMessage} onCancelReply={() => setReplyMessage(null)} />

        {showGroupInfo && <GroupManagement onClose={() => setShowGroupInfo(false)} />}
      </div>
    </div>
  );
};
