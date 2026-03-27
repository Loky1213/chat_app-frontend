'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  getEmojisByCategory,
  searchEmojis,
  CATEGORY_ORDER,
  getRecentEmojis,
  saveRecentEmoji,
  type Emoji,
} from '@/lib/emojis';
import { X, Search } from 'lucide-react';

interface EmojiPickerModalProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export const EmojiPickerModal = ({ onSelect, onClose }: EmojiPickerModalProps) => {
  const [activeCategory, setActiveCategory] = useState('Recent');
  const [search, setSearch] = useState('');
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Load categories once (memoized at module level inside getEmojisByCategory)
  const categoryGroups = useMemo(() => getEmojisByCategory(), []);

  // Build category icon map from first emoji of each category
  const categoryIcons = useMemo(() => {
    const icons: Record<string, string> = { Recent: '🕐' };
    for (const cat of CATEGORY_ORDER) {
      const emojis = categoryGroups[cat];
      icons[cat] = emojis?.[0]?.emoji ?? '😀';
    }
    return icons;
  }, [categoryGroups]);

  useEffect(() => {
    const recents = getRecentEmojis();
    setRecentEmojis(recents);
    if (recents.length === 0) setActiveCategory('Smileys');
  }, []);

  // Focus search on mount
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Use setTimeout so the opening click doesn't immediately close it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [onClose]);

  const handleSelect = (emoji: string) => {
    saveRecentEmoji(emoji);
    setRecentEmojis(getRecentEmojis());
    onSelect(emoji);
  };

  // Build display emojis based on search or active category
  const displayEmojis: string[] = useMemo(() => {
    if (search) {
      return searchEmojis(search).map(em => em.emoji);
    }
    if (activeCategory === 'Recent') {
      return recentEmojis;
    }
    const group = categoryGroups[activeCategory];
    return group ? group.map(em => em.emoji) : [];
  }, [search, activeCategory, recentEmojis, categoryGroups]);

  // Tab order: Recent + CATEGORY_ORDER
  const tabOrder = useMemo(() => ['Recent', ...CATEGORY_ORDER], []);

  return (
    <div
      ref={containerRef}
      className="bg-white rounded-xl shadow-2xl border border-gray-200 w-80 overflow-hidden animate-in fade-in zoom-in-95 duration-150 z-[200]"
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <span className="text-sm font-semibold text-gray-700">Emoji</span>
        <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5">
          <Search size={14} className="text-gray-400 flex-shrink-0" />
          <input
            ref={searchRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search emoji..."
            className="bg-transparent text-sm outline-none flex-1 text-gray-700 placeholder-gray-400"
          />
        </div>
      </div>

      {/* Category Tabs */}
      {!search && (
        <div className="flex gap-0.5 px-2 pb-1 border-b border-gray-100 overflow-x-auto">
          {tabOrder.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-2 py-1.5 text-base rounded-lg transition-all flex-shrink-0 ${
                activeCategory === cat
                  ? 'bg-blue-50 scale-110'
                  : 'hover:bg-gray-100 opacity-60 hover:opacity-100'
              }`}
              title={cat}
            >
              {categoryIcons[cat] || '😀'}
            </button>
          ))}
        </div>
      )}

      {/* Emoji Grid */}
      <div className="grid grid-cols-8 gap-0.5 p-2 max-h-56 overflow-y-auto">
        {displayEmojis.length > 0 ? (
          displayEmojis.map((emoji, i) => (
            <button
              key={`${emoji}-${i}`}
              onClick={() => handleSelect(emoji)}
              className="text-xl w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 hover:scale-110 active:scale-90 transition-transform"
            >
              {emoji}
            </button>
          ))
        ) : (
          <div className="col-span-8 text-center text-sm text-gray-400 py-6">
            {activeCategory === 'Recent' ? 'No recent emojis yet' : 'No emojis found'}
          </div>
        )}
      </div>
    </div>
  );
};
