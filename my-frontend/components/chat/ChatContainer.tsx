'use client';

import { useEffect, useState } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { usePresenceStore } from '@/store/usePresenceStore';
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
  const conversations = useChatStore((state) => state.conversations);
  const fetchConversations = useChatStore((state) => state.fetchConversations);
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const { user: currentUser } = useAuth();
  const { sendMessage, sendDeleteMessage, sendTyping, sendReadReceipt, sendReaction } = useChatWebSocket(activeConversationId);
  const [replyMessage, setReplyMessage] = useState<Message | null>(null);
  useGlobalWebSocket();

  // Hydrate presence on app load
  useEffect(() => {
    if (currentUser?.id) {
      const store = usePresenceStore.getState();
      if (!store.isInitialized) {
        store.hydratePresence();
      }
    }
  }, [currentUser]);

  const activeConversation = conversations.find(c => String(c.id) === String(activeConversationId));

  const isPrivateChat = activeConversation &&
    activeConversation.participants.length <= 2 &&
    !activeConversation.name;
  const otherParticipant = isPrivateChat
    ? activeConversation.participants.find(p => String(p.id) !== String(currentUser?.id))
    : null;
  
  // CRITICAL: Use SELECTOR-based subscription for online status
  // This ensures proper reactivity when onlineUsers Set changes
  const isOnline = usePresenceStore(
    (s) => otherParticipant ? s.onlineUsers.has(String(otherParticipant.id)) : false
  );

  // Initialize conversation list on mount
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // FIX: Use the store's fetchMessages instead of calling chatApi directly.
  // The store normalizes messages consistently; calling chatApi directly
  // bypasses normalizeMessages and can produce differently shaped objects.
  useEffect(() => {
    if (!activeConversationId) return;
    useChatStore.getState().fetchMessages(activeConversationId);
  }, [activeConversationId]);

  return (
    <div className="flex h-screen bg-gray-100 font-sans text-gray-900 border overflow-hidden">
      {/* Sidebar */}
      <ConversationList />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white shadow-xl z-10 relative border-l border-gray-200">
        {activeConversation && (
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white shadow-sm z-10">
            <div>
              <h2 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                {activeConversation.name ||
                  activeConversation.participants
                    .filter(p => String(p.id) !== String(currentUser?.id))
                    .map(p => p.username)
                    .join(', ') ||
                  'Chat'}
              </h2>
              {activeConversation.participants.length > 2 ? (
                <div className="text-xs text-gray-500">
                  {activeConversation.participants.length} participants
                </div>
              ) : (
                isOnline && <div className="text-xs text-green-500 font-medium">Online</div>
              )}
            </div>
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

        <MessageList
          sendReadReceipt={sendReadReceipt}
          sendDeleteMessage={sendDeleteMessage}
          onReply={setReplyMessage}
          sendReaction={sendReaction}
        />
        <MessageInput
          sendMessage={sendMessage}
          sendTyping={sendTyping}
          replyMessage={replyMessage}
          onCancelReply={() => setReplyMessage(null)}
        />

        {showGroupInfo && <GroupManagement onClose={() => setShowGroupInfo(false)} />}
      </div>
    </div>
  );
};;