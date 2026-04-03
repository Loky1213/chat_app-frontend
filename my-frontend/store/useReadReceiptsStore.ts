'use client';

import { create } from 'zustand';
import { chatApi } from '@/services/api/chat';

const READ_RECEIPTS_KEY = 'read_receipts_enabled';
const DISABLED_MESSAGES_KEY = 'read_receipts_disabled_messages';

const getStoredValue = (): boolean => {
  if (typeof window === 'undefined') return true;
  const stored = localStorage.getItem(READ_RECEIPTS_KEY);
  return stored === null ? true : stored === 'true';
};

const saveValue = (value: boolean) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(READ_RECEIPTS_KEY, String(value));
};

const getDisabledMessageIds = (): Set<string> => {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = localStorage.getItem(DISABLED_MESSAGES_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
};

const saveDisabledMessageIds = (ids: Set<string>) => {
  if (typeof window === 'undefined') return;
  const arr = Array.from(ids).slice(-1000); // Keep last 1000
  localStorage.setItem(DISABLED_MESSAGES_KEY, JSON.stringify(arr));
};

interface ReadReceiptsState {
  isEnabled: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  disabledMessageIds: Set<string>;
  setIsEnabled: (enabled: boolean) => void;
  toggleReadReceipts: (nextValue: boolean) => Promise<void>;
  hydrateFromStorage: () => void;
  trackMessageSentWhileDisabled: (messageId: string) => void;
  isMessageSentWhileDisabled: (messageId: string) => boolean;
}

export const useReadReceiptsStore = create<ReadReceiptsState>((set, get) => ({
  isEnabled: true,
  isLoading: false,
  isInitialized: false,
  disabledMessageIds: new Set(),

  hydrateFromStorage: () => {
    const stored = getStoredValue();
    const disabledIds = getDisabledMessageIds();
    console.log('[ReadReceipts] Hydrating from storage:', stored, 'disabled msgs:', disabledIds.size);
    set({ isEnabled: stored, isInitialized: true, disabledMessageIds: disabledIds });
  },

  setIsEnabled: (enabled: boolean) => {
    saveValue(enabled);
    set({ isEnabled: enabled, isInitialized: true });
  },

  toggleReadReceipts: async (nextValue: boolean) => {
    const prev = get().isEnabled;

    // Optimistic update + persist
    set({ isEnabled: nextValue, isLoading: true });
    saveValue(nextValue);
    console.log('[ReadReceipts] Optimistic update:', nextValue);

    try {
      const res = await chatApi.toggleReadReceipts(nextValue);
      console.log('[ReadReceipts] API response:', res);
      saveValue(res.is_enabled);
      set({ isEnabled: res.is_enabled, isLoading: false, isInitialized: true });
    } catch (err: any) {
      console.error('[ReadReceipts] Toggle failed:', err);
      saveValue(prev);
      set({ isEnabled: prev, isLoading: false });
    }
  },

  trackMessageSentWhileDisabled: (messageId: string) => {
    if (get().isEnabled) return; // Only track if disabled
    const ids = new Set(get().disabledMessageIds);
    ids.add(String(messageId));
    saveDisabledMessageIds(ids);
    set({ disabledMessageIds: ids });
    console.log('[ReadReceipts] Tracked message sent while disabled:', messageId);
  },

  isMessageSentWhileDisabled: (messageId: string) => {
    return get().disabledMessageIds.has(String(messageId));
  },
}));

// Auto-hydrate on load
if (typeof window !== 'undefined') {
  useReadReceiptsStore.getState().hydrateFromStorage();
}
