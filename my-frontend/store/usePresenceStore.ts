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
  toggleHideOnline: (value: boolean) => Promise<void>;
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  onlineUsers: new Set<string>(),
  isHidden: false,
  isInitialized: false,
  currentUserId: null,

  setCurrentUserId: (id) => set({ currentUserId: id !== null ? String(id) : null }),

  hydratePresence: async () => {
    try {
      const [onlineIds, myPresence] = await Promise.all([
        chatApi.getOnlineUsers(),
        chatApi.getMyPresence(),
      ]);

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
    set((state) => {
      const updated = new Set(state.onlineUsers);
      updated.add(String(id));
      return { onlineUsers: updated };
    });
  },

  setUserOffline: (id) => {
    set((state) => {
      const updated = new Set(state.onlineUsers);
      updated.delete(String(id));
      return { onlineUsers: updated };
    });
  },

  toggleHideOnline: async (hideOnline: boolean) => {
    // FIX: Guard against toggling before hydration has completed.
    // Without this, the first toggle fires with stale isHidden: false,
    // then hydratePresence overwrites it and the toggle visually snaps back.
    if (!get().isInitialized) return;

    const prev = get().isHidden;
    const userId = get().currentUserId;

    // Optimistic update
    set({ isHidden: hideOnline });

    try {
      await chatApi.toggleHideOnline(hideOnline);

      if (userId) {
        set((state) => {
          const updated = new Set(state.onlineUsers);
          if (hideOnline) {
            updated.delete(String(userId));
          } else {
            updated.add(String(userId));
          }
          return { onlineUsers: updated };
        });
      }
    } catch (err) {
      console.error('[Presence] Failed to toggle:', err);
      set({ isHidden: prev }); // rollback on failure
    }
  },
}));