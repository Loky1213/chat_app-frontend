import { create } from 'zustand';
import { chatApi } from '@/services/api/chat';

interface PresenceState {
  onlineUsers: Set<string>;
  isHidden: boolean;
  isInitialized: boolean;
  currentUserId: string | null;

  setCurrentUserId: (id: string | number | null) => void;
  hydratePresence: () => Promise<void>;
  setUserOnline: (id: string) => void;
  setUserOffline: (id: string) => void;
  toggleHideOnline: () => Promise<void>;
  resetPresence: () => void;
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  onlineUsers: new Set<string>(),
  isHidden: false,
  isInitialized: false,
  currentUserId: null,

  setCurrentUserId: (id) => {
    const newId = id !== null ? String(id) : null;
    const current = get().currentUserId;
    
    // FIX: If user ID changes (different user logged in), reset the store
    // to force re-hydration with the new user's presence state.
    if (current !== null && current !== newId) {
      console.log('[Presence] User changed, resetting store');
      set({
        currentUserId: newId,
        isHidden: false,
        isInitialized: false,
        onlineUsers: new Set<string>(),
      });
    } else {
      set({ currentUserId: newId });
    }
  },

  hydratePresence: async () => {
    const userId = get().currentUserId;
    console.log('[Presence] Hydrating for user:', userId);
    
    try {
      const [onlineIds, myPresence] = await Promise.all([
        chatApi.getOnlineUsers(),
        chatApi.getMyPresence(),
      ]);

      console.log('[Presence] Hydrated - online:', onlineIds, 'isHidden:', myPresence.is_hidden);
      
      set({
        onlineUsers: new Set(onlineIds.map(String)),
        isHidden: myPresence.is_hidden ?? false,
        isInitialized: true,
      });
    } catch (err) {
      console.error('[Presence] Hydration failed:', err);
      set({ isInitialized: true });
    }
  },

  setUserOnline: (id) => {
    console.log('[Presence] setUserOnline called for:', id);
    set((state) => {
      const updated = new Set(state.onlineUsers);
      updated.add(String(id));
      console.log('[Presence] onlineUsers after add:', Array.from(updated));
      return { onlineUsers: updated };
    });
  },

  setUserOffline: (id) => {
    console.log('[Presence] setUserOffline called for:', id);
    set((state) => {
      const updated = new Set(state.onlineUsers);
      updated.delete(String(id));
      console.log('[Presence] onlineUsers after delete:', Array.from(updated));
      return { onlineUsers: updated };
    });
  },

  // Toggle without parameter - always uses current store state to avoid stale closures
  toggleHideOnline: async () => {
    if (!get().isInitialized) {
      console.warn('[Presence] Toggle blocked - not initialized');
      return;
    }

    const prev = get().isHidden;
    const userId = get().currentUserId;
    const hideOnline = !prev; // Toggle the current value

    console.log('[Presence] Toggling from', prev, 'to', hideOnline);
    
    // Optimistic update
    set({ isHidden: hideOnline });

    try {
      const response = await chatApi.toggleHideOnline(hideOnline);
      console.log('[Presence] API toggle success, response:', response, 'isHidden is now:', get().isHidden);

      // Update local onlineUsers set to reflect the change for SELF
      if (userId) {
        set((state) => {
          const updated = new Set(state.onlineUsers);
          if (hideOnline) {
            updated.delete(String(userId));
          } else {
            updated.add(String(userId));
          }
          console.log('[Presence] Updated onlineUsers for self:', Array.from(updated));
          return { onlineUsers: updated };
        });
      }
    } catch (err: any) {
      console.error('[Presence] Toggle failed:', err);
      console.error('[Presence] Error response:', err?.response?.data);
      console.error('[Presence] Error status:', err?.response?.status);
      set({ isHidden: prev }); // Rollback on failure
    }
  },

  resetPresence: () => {
    console.log('[Presence] Resetting store');
    set({
      onlineUsers: new Set<string>(),
      isHidden: false,
      isInitialized: false,
      currentUserId: null,
    });
  },
}));

// Debug: Subscribe to ALL state changes
if (typeof window !== 'undefined') {
  usePresenceStore.subscribe((state, prevState) => {
    if (state.isHidden !== prevState.isHidden) {
      console.log('[Presence] isHidden CHANGED:', prevState.isHidden, '→', state.isHidden);
      console.trace('[Presence] Stack trace for isHidden change');
    }
  });
}