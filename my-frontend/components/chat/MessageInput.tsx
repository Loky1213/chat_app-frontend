'use client';

import { useState } from 'react';
import { useChatWebSocket } from '@/hooks/useChatWebSocket';
import { useChatStore } from '@/store/useChatStore';
import { SendHorizontal } from 'lucide-react';

export const MessageInput = () => {
  const [content, setContent] = useState('');
  const { activeConversationId } = useChatStore();
  const { sendMessage } = useChatWebSocket(activeConversationId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !activeConversationId) return;
    
    sendMessage(content);
    setContent('');
  };

  if (!activeConversationId) return null;

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-white border-t border-gray-200 flex gap-2">
      <input
        type="text"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Type a message..."
        className="flex-1 bg-gray-100 border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-full px-4 py-2 text-sm outline-none transition-all"
      />
      <button
        type="submit"
        disabled={!content.trim()}
        className="bg-blue-600 text-white rounded-full p-2 w-10 h-10 flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <SendHorizontal size={18} />
      </button>
    </form>
  );
};
