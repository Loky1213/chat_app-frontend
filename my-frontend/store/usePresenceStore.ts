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
      console.error('Presence hydration failed:', err);
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

  toggleHideOnline: async (hideOnline) => {
    const prev = get().isHidden;
    const userId = get().currentUserId;

    // Optimistic update for toggle UI
    set({ isHidden: hideOnline });

    try {
      await chatApi.toggleHideOnline(hideOnline);

      // Immediately update own presence in the local Set
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
      console.error('Failed to toggle hide online:', err);
      set({ isHidden: prev }); // rollback
    }
  },
}));
