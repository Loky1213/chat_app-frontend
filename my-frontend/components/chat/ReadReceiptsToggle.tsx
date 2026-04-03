'use client';

import { useReadReceiptsStore } from '@/store/useReadReceiptsStore';

export const ReadReceiptsToggle = () => {
  const isEnabled = useReadReceiptsStore((s) => s.isEnabled);
  const isLoading = useReadReceiptsStore((s) => s.isLoading);
  const toggleReadReceipts = useReadReceiptsStore((s) => s.toggleReadReceipts);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (isLoading) {
      console.log('[ReadReceiptsToggle] Toggle blocked - loading');
      return;
    }
    
    const nextValue = !isEnabled;
    console.log('[ReadReceiptsToggle] Toggle clicked, setting to:', nextValue);
    toggleReadReceipts(nextValue);
  };

  return (
    <div 
      className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-lg text-sm border border-gray-200"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={handleToggle}
        disabled={isLoading}
        className="flex items-center gap-2 cursor-pointer select-none disabled:cursor-not-allowed disabled:opacity-50"
        style={{ opacity: isLoading ? 0.5 : 1 }}
      >
        <div className="relative pointer-events-none">
          <div 
            className={`w-9 h-5 rounded-full transition-colors ${
              isEnabled ? 'bg-blue-500' : 'bg-gray-300'
            }`} 
          />
          <div 
            className={`absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
              isEnabled ? 'translate-x-4' : 'translate-x-0'
            }`} 
          />
        </div>
        <span className="text-gray-600 font-medium pointer-events-none">
          {isLoading ? '...' : (isEnabled ? 'Read receipts' : 'Read receipts off')}
        </span>
      </button>
    </div>
  );
};
