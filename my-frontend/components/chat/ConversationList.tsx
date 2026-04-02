'use client';

import { useState, useEffect } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { chatApi } from '@/services/api/chat';
import { User, Conversation } from '@/types/chat';
import { Users, MessageSquarePlus, MessageSquare } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { CreateGroupModal } from './CreateGroupModal';
import { PresenceToggle } from './PresenceToggle';

const ConversationItem = ({ conversationId, currentUser }: { conversationId: string, currentUser: any }) => {
  const conversation = useChatStore((state) => state.conversations.find(c => String(c.id) === String(conversationId)));
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const setActiveConversationId = useChatStore((state) => state.setActiveConversationId);

  // VERIFY RERENDER
  console.log("RENDER:", conversation?.id);

  if (!conversation) return null;

  const getChatDisplayName = (conv: Conversation) => {
    if (conv.name) return conv.name;
    if (!conv.participants) return "Unknown Chat";
    if (!currentUser) return conv.participants.map(p => p.username).join(', ');

    const others = conv.participants.filter(p => String(p.id) !== String(currentUser.id));
    return others.length > 0 ? others.map(p => p.username).join(', ') : "Just You";
  };

  return (
    <div
      key={conversation.id}
      onClick={() => {
        if (activeConversationId === String(conversation.id)) return;
        setActiveConversationId(String(conversation.id));
      }}
      className={`cursor-pointer p-4 border-b border-gray-50 flex gap-3 transition-colors hover:bg-gray-50 items-center ${activeConversationId === String(conversation.id) ? 'bg-blue-50 border-blue-200 hover:bg-blue-100' : ''
        }`}
    >
      <div className="relative">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold flex-shrink-0">
          {getChatDisplayName(conversation)[0]?.toUpperCase()}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1">
          <span className="font-semibold text-gray-900 truncate">
            {getChatDisplayName(conversation)}
          </span>
          {conversation.unread_count > 0 && (
            <span className="bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {conversation.unread_count}
            </span>
          )}
        </div>
        {conversation.last_message && (
          <div className="text-sm text-gray-500 truncate flex items-center gap-1">
            <span className="truncate">{conversation.last_message.content}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export const ConversationList = () => {
  // Use IDs natively targeting the rendering evaluations preventing over-rendering scopes mapping loops
  const conversationIds = useChatStore((state) => state.conversationIds);
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const setActiveConversationId = useChatStore((state) => state.setActiveConversationId);
  const setConversations = useChatStore((state) => state.setConversations);
  const { user: currentUser } = useAuth();

  // Local state to toggle between viewing "conversations" or "contacts"
  const [view, setView] = useState<'conversations' | 'contacts'>('conversations');

  // Local state for contacts list
  const [contacts, setContacts] = useState<User[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  const getChatDisplayName = (conversation: Conversation) => {
    if (conversation.name) return conversation.name;
    if (!conversation.participants) return "Unknown Chat";
    if (!currentUser) return conversation.participants.map(p => p.username).join(', ');

    const others = conversation.participants.filter(p => String(p.id) !== String(currentUser.id));
    return others.length > 0 ? others.map(p => p.username).join(', ') : "Just You";
  };

  // Fetch contacts when switching to the 'contacts' view
  useEffect(() => {
    if (view === 'contacts' && contacts.length === 0) {
      const fetchContacts = async () => {
        setLoadingContacts(true);
        try {
          const data = await chatApi.getUsers();
          setContacts(data);
        } catch (error) {
          console.error("Failed to fetch users:", error);
        } finally {
          setLoadingContacts(false);
        }
      };
      fetchContacts();
    }
  }, [view, contacts.length]);

  // Handle clicking a contact
  const handleContactClick = async (userId: number) => {
    try {
      // Create or fetch the private conversation ID
      const { conversation_id } = await chatApi.createPrivateChat(userId);

      // Update the active conversation so ChatContainer loads it instantly
      setActiveConversationId(conversation_id);

      // We should ideally fetch conversations again so it appears in the Conversations list
      // Though ChatContainer might do this on mount, doing it here guarantees immediate update
      const updatedConversations = await chatApi.getConversations();
      setConversations(updatedConversations);

      // Switch back to "conversations" tab immediately
      setView('conversations');
    } catch (error) {
      console.error("Failed to create private chat:", error);
    }
  };

  return (
    <div className="flex flex-col overflow-hidden h-full border-r border-gray-200 w-full sm:w-80 flex-shrink-0 bg-white">
      {/* Sidebar Header / Tabs */}
      <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col gap-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-xl text-gray-800">
            {view === 'conversations' ? 'Chats' : 'New Chat'}
          </h2>

          <div className="flex items-center gap-1">
          {/* Create Group Button */}
          <button
            onClick={() => setShowCreateGroup(true)}
            className="p-2 rounded-full hover:bg-gray-200 transition-colors text-gray-600"
            title="Create Group"
          >
            <Users size={20} />
          </button>

          {/* Toggle Button */}
          <button
            onClick={() => setView(view === 'conversations' ? 'contacts' : 'conversations')}
            className="p-2 rounded-full hover:bg-gray-200 transition-colors text-gray-600"
            title={view === 'conversations' ? "Start New Chat" : "Back to Chats"}
          >
            {view === 'conversations' ? <MessageSquarePlus size={20} /> : <MessageSquare size={20} />}
          </button>
        </div>
        </div>
        <PresenceToggle />
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Render Conversations */}
        {view === 'conversations' && (
          <div>
            {conversationIds.length === 0 ? (
              <div className="p-8 text-center text-gray-400 flex flex-col items-center">
                <MessageSquare size={48} className="mb-4 opacity-20" />
                <p>No conversations yet.</p>
                <p className="text-sm mt-1">Click the + icon to start chatting!</p>
              </div>
            ) : (
              conversationIds.map((id) => (
                <ConversationItem key={String(id)} conversationId={String(id)} currentUser={currentUser} />
              ))
            )}
          </div>
        )}

        {/* Render Contacts List */}
        {view === 'contacts' && (
          <div>
            {loadingContacts ? (
              <div className="p-8 text-center text-gray-400 flex justify-center">
                <svg className="animate-spin h-6 w-6 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            ) : contacts.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">No contacts found on the server.</div>
            ) : (
              contacts.map((contact) => (
                <div
                  key={contact.id}
                  onClick={() => handleContactClick(contact.id)}
                  className="cursor-pointer p-3 border-b border-gray-50 flex gap-3 transition-colors hover:bg-gray-100 items-center"
                >
                  {/* Generic Avatar Placeholder */}
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-bold flex-shrink-0">
                      {contact.username[0].toUpperCase()}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800">{contact.username}</div>
                    {contact.email && <div className="text-xs text-gray-500">{contact.email}</div>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {showCreateGroup && (
        <CreateGroupModal
          onClose={() => setShowCreateGroup(false)}
          onSuccess={async (conversationId) => {
            setShowCreateGroup(false);
            try {
              const updatedConversations = await chatApi.getConversations();
              setConversations(updatedConversations);
              setActiveConversationId(conversationId);
              setView('conversations');
            } catch (error) {
              console.error(error);
            }
          }}
        />
      )}
    </div>
  );
};
