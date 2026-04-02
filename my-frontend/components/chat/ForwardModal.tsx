import React, { useState, useMemo } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { chatApi } from '@/services/api/chat';
import { X, Search, Check, Send } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface ForwardModalProps {
  messageId: number;
  onClose: () => void;
}

export const ForwardModal: React.FC<ForwardModalProps> = ({ messageId, onClose }) => {
  const conversations = useChatStore((state) => state.conversations);
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const messages = useChatStore((state) => state.messages);
  const updateConversationOnSend = useChatStore((state) => state.updateConversationOnSend);
  const { user: currentUser } = useAuth();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Exclude current active chat from forward targets
  const availableConversations = useMemo(() => {
    return conversations.filter(c => String(c.id) !== String(activeConversationId));
  }, [conversations, activeConversationId]);

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return availableConversations;
    const query = searchQuery.toLowerCase();
    
    return availableConversations.filter(c => {
      const name = c.name || c.participants.filter(p => String(p.id) !== String(currentUser?.id)).map(p => p.username).join(', ');
      return name.toLowerCase().includes(query);
    });
  }, [searchQuery, availableConversations, currentUser]);

  const toggleSelection = (conversationId: number) => {
    setSelectedIds(prev => {
      if (prev.includes(conversationId)) {
        return prev.filter(id => id !== conversationId);
      }
      if (prev.length >= 5) {
        return prev; // Already reached limit
      }
      return [...prev, conversationId];
    });
  };

  const handleForward = async () => {
    if (!selectedIds.length) return;
    
    if (selectedIds.some(id => typeof id !== "number")) {
      throw new Error("Invalid target IDs");
    }

    console.log("[Forward] Payload:", {
      message_id: messageId,
      target_ids: selectedIds
    });

    setIsSubmitting(true);
    setError(null);
    try {
      await chatApi.forwardMessage(messageId, selectedIds);

      // Optimistic UI: update sender's conversation list immediately
      const originalMessage = messages.find(m => String(m.id) === String(messageId));
      if (originalMessage && currentUser) {
        const now = new Date().toISOString();
        selectedIds.forEach(targetConvId => {
          console.log('[Forward] Optimistic update for conversation:', targetConvId);
          updateConversationOnSend({
            id: `fwd_${Date.now()}_${targetConvId}`,
            content: originalMessage.content,
            created_at: now,
            sender: currentUser,
            conversation_id: String(targetConvId),
            message_type: originalMessage.message_type || 'text',
            is_forwarded: true,
          });
        });
      }

      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to forward message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col h-[80vh] max-h-[600px] animate-in slide-in-from-bottom-4 duration-300">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-white z-10">
          <h2 className="text-xl font-bold text-gray-800">Forward Message</h2>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-100 bg-gray-50 z-10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search chats..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Error / Warning Alert */}
        <div className="px-4 pt-3 flex-shrink-0">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">
              {error}
            </div>
          )}
          {selectedIds.length === 5 && !error && (
            <div className="p-3 bg-amber-50 text-amber-600 rounded-lg text-sm font-medium border border-amber-100">
              Maximum of 5 chats selected.
            </div>
          )}
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-2">
          {filteredConversations.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">
              No chats found.
            </div>
          ) : (
            <div className="space-y-1">
              {filteredConversations.map(conv => {
                const isSelected = selectedIds.includes(Number(conv.id));
                const isDisabled = !isSelected && selectedIds.length >= 5;
                const displayName = conv.name || conv.participants.filter(p => String(p.id) !== String(currentUser?.id)).map(p => p.username).join(', ') || 'Chat';

                return (
                  <button
                    key={conv.id}
                    disabled={isDisabled}
                    onClick={() => toggleSelection(Number(conv.id))}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left group
                      ${isSelected ? 'bg-blue-50 cursor-pointer' : isDisabled ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:bg-gray-50 cursor-pointer'}
                    `}
                  >
                    {/* Avatar placeholder */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-blue-600 font-bold border border-blue-200 flex-shrink-0">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    
                    <span className="flex-1 truncate font-medium text-gray-800">
                      {displayName}
                    </span>
                    
                    {/* Checkbox */}
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors flex-shrink-0
                      ${isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 text-transparent'}
                    `}>
                      <Check size={12} strokeWidth={3} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-white">
          <button
            disabled={selectedIds.length === 0 || isSubmitting}
            onClick={handleForward}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-all shadow-sm
              ${selectedIds.length === 0 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20 hover:shadow-blue-500/40'
              }
            `}
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Send size={18} />
                <span>Forward to {selectedIds.length} {selectedIds.length === 1 ? 'chat' : 'chats'}</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
