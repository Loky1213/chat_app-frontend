'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { useChatWebSocket } from '@/hooks/useChatWebSocket';
import { format } from 'date-fns';
import { Check, CheckCheck, Trash2, MoreVertical, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface MessageListProps {
  sendReadReceipt: (messageId?: string) => void;
  sendDeleteMessage: (messageId: string, mode: 'me' | 'everyone') => void;
}

export const MessageList = ({ sendReadReceipt, sendDeleteMessage }: MessageListProps) => {
  const { messages, activeConversationId, readReceiptsUserIds, typingUsers, conversations, socket } = useChatStore();
  const { user } = useAuth();
  const bottomRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const activeConversation = conversations.find(c => c.id === activeConversationId);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  
  // Scroll to bottom whenever messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Observe individual messages for read receipts
  const messageCallbackRef = useCallback((node: HTMLDivElement | null) => {
    if (!node || !activeConversationId || !user) return;
    
    // Only observe unread incoming messages
    if (node.dataset.mine === 'true' || node.dataset.read === 'true') return;

    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const msgId = (entry.target as HTMLDivElement).dataset.messageId;
              if (msgId) {
                sendReadReceipt(msgId);
                observerRef.current?.unobserve(entry.target);
              }
            }
          });
        },
        { threshold: 0.5 }
      );
    }

    observerRef.current.observe(node);
  }, [activeConversationId, user, sendReadReceipt]);

  // Handle activeConversation change cleanup
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [activeConversationId]);

  // Dispatch a global conversation marker to reset backend unread_count reliably upon opening
  // Ensure we wait for the WebSocket to fully connect before firing, otherwise it fails silently
  useEffect(() => {
    if (activeConversationId && socket && socket.readyState === WebSocket.OPEN) {
      sendReadReceipt(); // Empty messageId triggers global conversation mark-read fallback
    }
  }, [activeConversationId, socket, sendReadReceipt]);

  if (!activeConversationId) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        Select a conversation to start messaging
      </div>
    );
  }

  const typingParticipantIds = Object.keys(typingUsers).filter(
    id => String(id) !== String(user?.id) && activeConversation?.participants.some(p => String(p.id) === id)
  );
  
  const typingUsernames = typingParticipantIds.map(
    id => activeConversation?.participants.find(p => String(p.id) === String(id))?.username
  ).filter(Boolean);

  return (
    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-gray-50 h-full relative" onClick={() => setActiveMenuId(null)}>
      {[...messages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map((msg) => {
        const isMine = user && String(msg.sender.id) === String(user.id);
        const isReadByMe = user && msg.read_by?.includes(user.id);
        const readByArray = msg.read_by || (msg as any).read_receipts || (msg as any).seen_by;
        const isRead = 
          (readByArray && readByArray.some((reader: any) => {
            const readerId = typeof reader === 'object' ? reader.id : reader;
            return String(readerId) !== String(user?.id);
          })) || 
          readReceiptsUserIds.some(id => String(id) !== String(user?.id));

        return (
          <div
            key={`${msg.id}-${msg.created_at}`}
            ref={messageCallbackRef}
            data-message-id={msg.id}
            data-mine={isMine}
            data-read={isReadByMe}
            className={`flex flex-col max-w-[70%] relative ${isMine ? 'self-end' : 'self-start'} group`}
          >
            <div className={`flex gap-2 items-end ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
              <div 
                className={`py-2 px-4 rounded-2xl shadow-sm text-sm relative ${
                  msg.deleted_for_everyone 
                    ? 'bg-gray-200 text-gray-500 italic border border-gray-300'
                    : isMine 
                      ? 'bg-blue-600 text-white rounded-br-none' 
                      : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
                }`}
              >
                {!isMine && !msg.deleted_for_everyone && (
                  <div className="text-xs font-semibold text-blue-500 mb-1">
                    {msg.sender.username}
                  </div>
                )}
                {msg.deleted_for_everyone ? 'This message was deleted' : msg.content}
              </div>
              
              {/* Message Actions Menu */}
              {isMine && !msg.deleted_for_everyone && (
                <div className="relative opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === msg.id ? null : msg.id); }}
                    className="p-1 rounded-full hover:bg-gray-200 text-gray-400"
                  >
                    <MoreVertical size={16} />
                  </button>
                  {activeMenuId === msg.id && (
                    <div className="absolute top-0 right-6 bg-white shadow-lg rounded-md border border-gray-100 text-sm z-10 w-40 overflow-hidden" onClick={e => e.stopPropagation()}>
                      <button 
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 flex items-center gap-2"
                        onClick={() => { sendDeleteMessage(msg.id, 'me'); setActiveMenuId(null); }}
                      >
                        <X size={14} /> Delete for me
                      </button>
                      <button 
                        className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2 border-t border-gray-100"
                        onClick={() => { sendDeleteMessage(msg.id, 'everyone'); setActiveMenuId(null); }}
                      >
                        <Trash2 size={14} /> Delete for everyone
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className={`flex items-center mt-1 text-xs text-gray-400 gap-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
              <span>{format(new Date(msg.created_at), 'hh:mm a')}</span>
              {isMine && (
                isRead ? <CheckCheck size={14} className="text-blue-500" /> : <CheckCheck size={14} className="text-gray-400" />
              )}
            </div>
          </div>
        );
      })}
      {typingUsernames.length > 0 && (
        <div className="text-xs text-gray-500 italic flex items-center gap-2 ml-2 pb-2">
           <div className="flex gap-1">
             <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
             <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
             <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
           </div>
           {typingUsernames.join(', ')} {typingUsernames.length > 1 ? 'are' : 'is'} typing...
        </div>
      )}
      <div ref={bottomRef} className="h-4" />
    </div>
  );
};
