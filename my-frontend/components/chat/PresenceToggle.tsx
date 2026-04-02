'use client';

import { usePresenceStore } from '@/store/usePresenceStore';

export const PresenceToggle = () => {
  const isHidden = usePresenceStore((s) => s.isHidden);
  const isInitialized = usePresenceStore((s) => s.isInitialized);
  const toggleHideOnline = usePresenceStore((s) => s.toggleHideOnline);

  // Render the toggle immediately without waiting for hydration
  // to ensure UI stability.
  
  return (
    <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-lg text-sm border border-gray-200">
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <div className="relative">
          <input
            type="checkbox"
            checked={isHidden}
            onChange={() => toggleHideOnline(!isHidden)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-gray-300 rounded-full peer-checked:bg-gray-700 transition-colors" />
          <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-4" />
        </div>
        <span className="text-gray-600 font-medium">
          {isHidden ? 'Hidden' : 'Visible'}
        </span>
      </label>
    </div>
  );
};
