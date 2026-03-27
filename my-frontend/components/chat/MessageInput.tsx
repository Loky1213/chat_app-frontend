'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { SendHorizontal, X, Smile } from 'lucide-react';
import { Message } from '@/types/chat';
import { useAuth } from '@/context/AuthContext';
import { searchEmojis, saveRecentEmoji, type Emoji } from '@/lib/emojis';
import { EmojiPickerModal } from './EmojiPickerModal';

interface MessageInputProps {
  sendMessage: (content: string, replyToId?: string) => void;
  sendTyping: () => void;
  replyMessage?: Message | null;
  onCancelReply?: () => void;
}

export const MessageInput = ({ sendMessage, sendTyping, replyMessage, onCancelReply }: MessageInputProps) => {
  const [content, setContent] = useState('');
  const { activeConversationId } = useChatStore();
  const { user } = useAuth();
  const lastTypingTime = useRef<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Colon search state
  const [colonQuery, setColonQuery] = useState('');
  const [showColonSuggestions, setShowColonSuggestions] = useState(false);
  const [colonResults, setColonResults] = useState<Emoji[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);

  // Emoji picker state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Debounced search timer
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !activeConversationId) return;
    
    sendMessage(content, replyMessage?.id);
    setContent('');
    setShowColonSuggestions(false);
    if (onCancelReply) onCancelReply();
  };

  const performColonSearch = useCallback((query: string) => {
    const results = searchEmojis(query).slice(0, 8);
    setColonResults(results);
    setShowColonSuggestions(results.length > 0);
    setSelectedSuggestionIndex(0);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setContent(value);

    // Throttle typing events
    const now = Date.now();
    if (now - lastTypingTime.current > 3000) {
      sendTyping();
      lastTypingTime.current = now;
    }

    // Colon search detection
    const cursor = e.target.selectionStart || value.length;
    const textBeforeCursor = value.slice(0, cursor);
    const match = textBeforeCursor.match(/:(\w{1,})$/);

    if (match) {
      const query = match[1];
      setColonQuery(query);

      // Debounce search (100ms)
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      searchTimerRef.current = setTimeout(() => {
        performColonSearch(query);
      }, 100);
    } else {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      setShowColonSuggestions(false);
    }
  };

  const insertEmoji = (emoji: string) => {
    const input = inputRef.current;
    if (!input) return;

    const cursor = input.selectionStart || content.length;
    const before = content.slice(0, cursor);
    const after = content.slice(cursor);
    const newBefore = before.replace(/:\w*$/, emoji);

    setContent(newBefore + after);
    setShowColonSuggestions(false);
    saveRecentEmoji(emoji);

    // Restore focus after state update
    setTimeout(() => {
      input.focus();
      const newCursor = newBefore.length;
      input.setSelectionRange(newCursor, newCursor);
    }, 0);
  };

  const handlePickerSelect = (emoji: string) => {
    const input = inputRef.current;
    const cursor = input?.selectionStart ?? content.length;
    const newContent = content.slice(0, cursor) + emoji + content.slice(cursor);
    setContent(newContent);
    setShowEmojiPicker(false);
    saveRecentEmoji(emoji);

    setTimeout(() => {
      input?.focus();
      const newCursor = cursor + emoji.length;
      input?.setSelectionRange(newCursor, newCursor);
    }, 0);
  };

  // Keyboard navigation for colon suggestions
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showColonSuggestions || colonResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestionIndex(i => Math.min(i + 1, colonResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestionIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (showColonSuggestions) {
        e.preventDefault();
        insertEmoji(colonResults[selectedSuggestionIndex].emoji);
      }
    } else if (e.key === 'Escape') {
      setShowColonSuggestions(false);
    }
  };

  if (!activeConversationId) return null;

  return (
    <div className="sticky bottom-0 bg-white border-t border-gray-200 z-20 flex flex-col w-full">
      {replyMessage && (
        <div className="p-2 bg-gray-50 border-l-4 border-blue-500 flex justify-between items-start mx-4 mt-2 rounded">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-blue-600 mb-0.5">
              Replying to {user && String(replyMessage.sender.id) === String(user.id) ? 'You' : replyMessage.sender.username}
            </p>
            <p className="text-sm text-gray-600 truncate max-w-xs">
              {replyMessage.content === 'This message was deleted' ? 'Message deleted' : replyMessage.content}
            </p>
          </div>
          <button onClick={onCancelReply} className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 ml-2 transition-colors flex-shrink-0">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="relative">
        {/* Colon Search Suggestions */}
        {showColonSuggestions && (
          <div className="absolute bottom-full left-4 right-4 mb-1 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-[200] max-h-64 overflow-y-auto">
            {colonResults.map((em, i) => (
              <button
                key={em.emoji + em.name}
                onClick={() => insertEmoji(em.emoji)}
                onMouseEnter={() => setSelectedSuggestionIndex(i)}
                className={`w-full text-left px-3 py-2 flex items-center gap-3 text-sm transition-colors ${
                  i === selectedSuggestionIndex ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="text-xl">{em.emoji}</span>
                <span className="text-gray-500">:{em.name.replace(/\s+/g, '_')}:</span>
              </button>
            ))}
          </div>
        )}

        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div className="absolute bottom-full right-4 mb-2">
            <EmojiPickerModal
              onSelect={handlePickerSelect}
              onClose={() => setShowEmojiPicker(false)}
            />
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-4 flex gap-2 items-center">
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
          >
            <Smile size={20} />
          </button>
          <input
            ref={inputRef}
            type="text"
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (use :emoji_name to search)"
            className="flex-1 bg-gray-100 border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-full px-4 py-2 text-sm outline-none transition-all"
          />
          <button
            type="submit"
            disabled={!content.trim()}
            className="bg-blue-600 text-white rounded-full p-2 w-10 h-10 flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            <SendHorizontal size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};
