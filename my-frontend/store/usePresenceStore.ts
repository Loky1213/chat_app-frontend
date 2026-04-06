import { create } from 'zustand';
import { chatApi } from '@/services/api/chat';

interface PresenceState {
  onlineUsers: Set<string>;
  isVisible: boolean;
  isInitialized: boolean;

  hydratePresence: () => Promise<void>;
  setUserOnline: (id: string) => void;
  setUserOffline: (id: string) => void;
  toggleVisibility: (value: boolean) => Promise<void>;
  resetPresence: () => void;
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  onlineUsers: new Set<string>(),
  isVisible: true,
  isInitialized: false,

  hydratePresence: async () => {
    // Run ONLY once - after this, WebSocket is source of truth
    if (get().isInitialized) {
      console.log('[Presence] Already initialized, skipping hydration');
      return;
    }

    console.log('[Presence] Hydrating presence...');
    
    try {
      const [onlineIds, myPresence] = await Promise.all([
        chatApi.getOnlineUsers(),
        chatApi.getMyPresence(),
      ]);

      console.log('[Presence] Hydrated - online:', onlineIds, 'isVisible:', myPresence.is_visible);
      
      set({
        onlineUsers: new Set(onlineIds.map(String)),
        isVisible: myPresence.is_visible,
        isInitialized: true,
      });

      // DEBUG: Log online users
      console.log('ONLINE USERS:', onlineIds);
    } catch (err) {
      console.error('[Presence] Hydration failed:', err);
      set({ isInitialized: true });
    }
  },

  // CRITICAL: Always return new Set for Zustand reactivity
  setUserOnline: (id) => {
    console.log('[Presence] setUserOnline:', id);
    set((state) => {
      const updated = new Set(state.onlineUsers);
      updated.add(String(id));
      console.log('ONLINE USERS:', Array.from(updated));
      return { onlineUsers: new Set(updated) };
    });
  },

  // CRITICAL: Always return new Set for Zustand reactivity
  setUserOffline: (id) => {
    console.log('[Presence] setUserOffline:', id);
    set((state) => {
      const updated = new Set(state.onlineUsers);
      updated.delete(String(id));
      console.log('ONLINE USERS:', Array.from(updated));
      return { onlineUsers: new Set(updated) };
    });
  },

  toggleVisibility: async (value: boolean) => {
    if (!get().isInitialized) {
      console.warn('[Presence] Toggle blocked - not initialized');
      return;
    }

    const prev = get().isVisible;
    console.log('[Presence] Toggling visibility from', prev, 'to', value);
    
    // Optimistic update
    set({ isVisible: value });

    try {
      await chatApi.togglePresence(value);
      console.log('[Presence] Toggle success, isVisible:', value);
      // IMPORTANT: Do NOT manually update onlineUsers here
      // Backend + WebSocket will sync automatically
    } catch (err) {
      console.error('[Presence] Toggle failed:', err);
      set({ isVisible: prev }); // Rollback on failure
    }
  },

  resetPresence: () => {
    console.log('[Presence] Resetting store');
    set({
      onlineUsers: new Set<string>(),
      isVisible: true,
      isInitialized: false,
    });
  },
}));