'use client';

import { useEffect, useRef } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { useChatWebSocket } from '@/hooks/useChatWebSocket';
import { format } from 'date-fns';
import { Check, CheckCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export const MessageList = () => {
  const { messages, activeConversationId, readReceiptsUserIds } = useChatStore();
  const { user } = useAuth();
  const { sendReadReceipt } = useChatWebSocket(activeConversationId);
  const bottomRef = useRef<HTMLDivElement>(null);
  
  // Scroll to bottom whenever messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle Mark as Read Intersection Observer
  useEffect(() => {
    if (!bottomRef.current || !activeConversationId || messages.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          sendReadReceipt();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(bottomRef.current);
    
    return () => observer.disconnect();
  }, [messages, activeConversationId, sendReadReceipt]);

  if (!activeConversationId) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        Select a conversation to start messaging
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-gray-50 h-full">
      {[...messages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map((msg) => {
        const isMine = user && String(msg.sender.id) === String(user.id);
        const isRead = 
          (msg.read_by && msg.read_by.some(id => String(id) !== String(user?.id))) || 
          readReceiptsUserIds.some(id => String(id) !== String(user?.id));

        return (
          <div
            key={`${msg.id}-${msg.created_at}`}
            className={`flex flex-col max-w-[70%] ${isMine ? 'self-end' : 'self-start'}`}
          >
            <div className={`flex gap-2 items-end ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
              <div 
                className={`py-2 px-4 rounded-2xl shadow-sm text-sm ${
                  isMine 
                    ? 'bg-blue-600 text-white rounded-br-none' 
                    : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
                }`}
              >
                {!isMine && (
                  <div className="text-xs font-semibold text-blue-500 mb-1">
                    {msg.sender.username}
                  </div>
                )}
                {msg.content}
              </div>
            </div>
            
            <div className={`flex items-center mt-1 text-xs text-gray-400 gap-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
              <span>{format(new Date(msg.created_at), 'hh:mm a')}</span>
              {isMine && (
                isRead ? <CheckCheck size={14} className="text-blue-500" /> : <Check size={14} className="text-gray-400" />
              )}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} className="h-4" />
    </div>
  );
};
