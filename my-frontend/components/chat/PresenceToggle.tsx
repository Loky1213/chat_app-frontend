'use client';

import { usePresenceStore } from '@/store/usePresenceStore';

export const PresenceToggle = () => {
  const isHidden = usePresenceStore((s) => s.isHidden);
  const isInitialized = usePresenceStore((s) => s.isInitialized);
  const toggleHideOnline = usePresenceStore((s) => s.toggleHideOnline);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (!isInitialized) {
      console.log('[PresenceToggle] Toggle blocked - not initialized');
      return;
    }
    console.log('[PresenceToggle] Toggle clicked');
    toggleHideOnline(); // No parameter - store handles the toggle internally
  };

  return (
    <div 
      className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-lg text-sm border border-gray-200"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={handleToggle}
        disabled={!isInitialized}
        className="flex items-center gap-2 cursor-pointer select-none disabled:cursor-not-allowed disabled:opacity-50"
        style={{ opacity: isInitialized ? 1 : 0.5 }}
      >
        <div className="relative pointer-events-none">
          <div 
            className={`w-9 h-5 rounded-full transition-colors ${
              isHidden ? 'bg-gray-700' : 'bg-gray-300'
            }`} 
          />
          <div 
            className={`absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
              isHidden ? 'translate-x-4' : 'translate-x-0'
            }`} 
          />
        </div>
        <span className="text-gray-600 font-medium pointer-events-none">
          {isInitialized ? (isHidden ? 'Hidden' : 'Visible') : '...'}
        </span>
      </button>
    </div>
  );
};