'use client';

import { usePresenceStore } from '@/store/usePresenceStore';

export const PresenceToggle = () => {
  const isHidden = usePresenceStore((s) => s.isHidden);
  const isInitialized = usePresenceStore((s) => s.isInitialized);
  const toggleHideOnline = usePresenceStore((s) => s.toggleHideOnline);

  return (
    <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-lg text-sm border border-gray-200">
      <label
        className="flex items-center gap-2 cursor-pointer select-none"
        // FIX: visually indicate loading state before hydration
        style={{ opacity: isInitialized ? 1 : 0.5 }}
      >
        <div className="relative">
          <input
            type="checkbox"
            checked={isHidden}
            // FIX: disable the toggle until hydratePresence has finished.
            // Without this, a quick toggle before hydration fires with stale
            // isHidden: false, then gets overwritten by the hydration response.
            disabled={!isInitialized}
            onChange={() => toggleHideOnline(!isHidden)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-gray-300 rounded-full peer-checked:bg-gray-700 transition-colors peer-disabled:cursor-not-allowed" />
          <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-4" />
        </div>
        <span className="text-gray-600 font-medium">
          {isInitialized ? (isHidden ? 'Hidden' : 'Visible') : '...'}
        </span>
      </label>
    </div>
  );
};