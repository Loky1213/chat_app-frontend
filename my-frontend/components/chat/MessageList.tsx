'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { useReadReceiptsStore } from '@/store/useReadReceiptsStore';
import { format } from 'date-fns';
import { Check, CheckCheck, Trash2, MoreVertical, X, Forward, Reply, SmilePlus, Plus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ForwardModal } from './ForwardModal';
import { EmojiPickerModal } from './EmojiPickerModal';
import { saveRecentEmoji, getRecentEmojis } from '@/lib/emojis';

const DEFAULT_QUICK_EMOJIS = ['👍', '❤️', '😂', '🔥', '😮', '😢'];

interface MessageListProps {
  sendReadReceipt: (messageId?: string) => void;
  sendDeleteMessage: (messageId: string, mode: 'me' | 'everyone') => void;
  onReply: (message: any) => void;
  sendReaction: (messageId: string, emoji: string) => void;
}

export const MessageList = ({ sendReadReceipt, sendDeleteMessage, onReply, sendReaction }: MessageListProps) => {
  const messages = useChatStore((state) => state.messages);
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const typingUsers = useChatStore((state) => state.typingUsers);
  const conversations = useChatStore((state) => state.conversations);
  const socket = useChatStore((state) => state.socket);
  const readReceiptsEnabled = useReadReceiptsStore((state) => state.isEnabled);
  const { user } = useAuth();
  const bottomRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const activeConversation = conversations.find(c => String(c.id) === String(activeConversationId));

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [forwardMessageId, setForwardMessageId] = useState<string | null>(null);
  const [emojiPickerMsgId, setEmojiPickerMsgId] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const [quickReactMsgId, setQuickReactMsgId] = useState<string | null>(null);
  const quickReactRef = useRef<HTMLDivElement | null>(null);

  // Debug: track forward modal state
  useEffect(() => {
    console.log('[MessageList] forwardMessageId changed to:', forwardMessageId);
  }, [forwardMessageId]);

  const recentEmojis = getRecentEmojis();
  const quickEmojis = recentEmojis.length >= 5 ? recentEmojis.slice(0, 6) : DEFAULT_QUICK_EMOJIS;

  useEffect(() => {
    if (!emojiPickerMsgId) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setEmojiPickerMsgId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [emojiPickerMsgId]);

  useEffect(() => {
    if (!quickReactMsgId) return;
    const handler = (e: MouseEvent) => {
      if (quickReactRef.current && !quickReactRef.current.contains(e.target as Node)) {
        setQuickReactMsgId(null);
      }
    };
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 50);
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handler); };
  }, [quickReactMsgId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const messageCallbackRef = useCallback((node: HTMLDivElement | null) => {
    if (!node || !activeConversationId || !user) return;
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

  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [activeConversationId]);

  const lastOpenedRef = useRef<string | null>(null);

  useEffect(() => {
    if (activeConversationId && socket && socket.readyState === WebSocket.OPEN) {
      if (lastOpenedRef.current !== activeConversationId) {
        sendReadReceipt();
        lastOpenedRef.current = String(activeConversationId);
      }
    }
  }, [activeConversationId, socket, sendReadReceipt]);

  if (!activeConversationId) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        Select a conversation to start messaging
      </div>
    );
  }

  // typingUsers keys are strings — compare directly
  const typingParticipantIds = Object.keys(typingUsers).filter(
    id => id !== String(user?.id) &&
    activeConversation?.participants.some(p => String(p.id) === id)
  );

  const typingUsernames = typingParticipantIds.map(
    id => activeConversation?.participants.find(p => String(p.id) === id)?.username
  ).filter(Boolean);

  return (
    <div
      className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-gray-50 h-full relative"
      onClick={() => { setActiveMenuId(null); setEmojiPickerMsgId(null); }}
    >
      {[...messages]
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map((msg) => {
          const isMine = user && String(msg.sender?.id ?? (msg as any).sender_id) === String(user.id);
          const isReadByMe = !!(user && msg.read_by?.some(id => String(id) === String(user.id)));

          // Blue tick logic:
          // 1. Always show double tick for sent messages (gray = delivered)
          // 2. Blue tick ONLY if:
          //    - Message was NOT sent while read receipts was disabled
          //    - AND local toggle is ON
          //    - AND message's read_receipts_visible is not explicitly false (from backend)
          //    - AND someone has actually read the message
          
          const readByArray: any[] = msg.read_by || (msg as any).read_receipts || (msg as any).seen_by || [];
          
          // Check if this message was sent while read receipts was disabled
          const wasSentWhileDisabled = useReadReceiptsStore.getState().isMessageSentWhileDisabled(msg.id);
          
          // Check if blue ticks should be shown:
          // - Message was NOT sent while disabled (permanent - never shows blue)
          // - AND user's local toggle must be ON
          // - AND message-level visibility (if backend sends it) must not be false
          const canShowBlueTick = !wasSentWhileDisabled && readReceiptsEnabled && msg.read_receipts_visible !== false;
          
          // Check if any OTHER user has read this message
          const isReadByOther = readByArray.some((reader: any) => {
            const readerId = String(typeof reader === 'object' ? reader.id : reader);
            return readerId !== String(user?.id);
          });

          // Show BLUE tick only if: allowed AND someone read it
          const isRead = isMine && canShowBlueTick && isReadByOther;

          return (
            <div
              key={`${msg.id}-${msg.created_at}`}
              id={`msg-${msg.id}`}
              ref={messageCallbackRef}
              data-message-id={msg.id}
              data-mine={String(isMine)}
              data-read={String(isReadByMe)}
              className={`flex flex-col max-w-[70%] relative transition-colors duration-500 rounded-lg ${isMine ? 'self-end' : 'self-start'} group/msg`}
            >
              {/* Quick Reaction Bar */}
              {quickReactMsgId === msg.id && !emojiPickerMsgId && (
                <div
                  ref={quickReactRef}
                  className={`absolute -top-9 ${isMine ? 'right-0' : 'left-0'} flex gap-0.5 bg-white px-2 py-1 rounded-full shadow-lg border border-gray-100 z-[50] animate-in fade-in duration-100`}
                  onClick={e => e.stopPropagation()}
                >
                  {quickEmojis.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => { sendReaction(msg.id, emoji); saveRecentEmoji(emoji); setQuickReactMsgId(null); }}
                      className="text-base w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 hover:scale-125 active:scale-90 transition-transform"
                    >
                      {emoji}
                    </button>
                  ))}
                  <button
                    onClick={() => { setEmojiPickerMsgId(msg.id); setQuickReactMsgId(null); }}
                    className="text-sm w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              )}

              <div className={`flex gap-2 items-end ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                <div
                  className={`py-2 px-4 rounded-2xl shadow-sm text-sm relative min-w-[120px] ${
                    msg.deleted_for_everyone
                      ? 'bg-gray-200 text-gray-500 italic border border-gray-300'
                      : isMine
                        ? 'bg-blue-600 text-white rounded-br-none'
                        : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
                  }`}
                >
                  {msg.is_forwarded && !msg.deleted_for_everyone && (
                    <div className={`flex items-center gap-1 text-[10px] mb-1 italic ${isMine ? 'text-blue-200' : 'text-gray-400'}`}>
                      <Forward size={10} /> Forwarded
                    </div>
                  )}
                  {!isMine && !msg.deleted_for_everyone && (
                    <div className="text-xs font-semibold text-blue-500 mb-1">
                      {msg.sender?.username ?? (msg as any).sender_username ?? (msg as any).sender_name ?? 'User'}
                    </div>
                  )}
                  {msg.deleted_for_everyone || msg.content === 'This message was deleted' ? (
                    'This message was deleted'
                  ) : (
                    <div className="flex flex-col min-w-0">
                      {msg.reply_to && (
                        <div
                          onClick={() => {
                            const el = document.getElementById(`msg-${msg.reply_to!.id}`);
                            if (el) {
                              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              el.classList.add('bg-yellow-100');
                              setTimeout(() => el.classList.remove('bg-yellow-100'), 1500);
                            }
                          }}
                          className={`text-xs p-2 rounded mb-1 border-l-2 cursor-pointer transition-colors ${
                            isMine
                              ? 'bg-blue-700/30 border-blue-400 hover:bg-blue-700/50'
                              : 'bg-gray-100 border-gray-400 hover:bg-gray-200'
                          }`}
                        >
                          <p className={`font-semibold mb-0.5 ${isMine ? 'text-blue-100' : 'text-blue-600'}`}>
                            {String(msg.reply_to.sender_id) === String(user?.id) ? 'You' : msg.reply_to.sender_username}
                          </p>
                          <p className={`truncate opacity-90 max-w-[200px] ${isMine ? 'text-white' : 'text-gray-600'}`}>
                            {msg.reply_to.content === 'This message was deleted' ? 'Message deleted' : msg.reply_to.content}
                          </p>
                        </div>
                      )}
                      <div>{msg.content}</div>
                    </div>
                  )}
                </div>

                {/* Message Actions */}
                {!msg.deleted_for_everyone && msg.content !== 'This message was deleted' && (
                  <div className={`relative opacity-0 group-hover/msg:opacity-100 transition-opacity flex-shrink-0 ${isMine ? 'order-first' : 'order-last'}`}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === msg.id ? null : msg.id); }}
                      className="p-1 rounded-full hover:bg-gray-200 text-gray-400"
                    >
                      <MoreVertical size={16} />
                    </button>
                    {activeMenuId === msg.id && (
                      <div
                        className="absolute top-0 right-6 bg-white shadow-lg rounded-md border border-gray-100 text-sm z-[100] w-40 overflow-hidden"
                        onClick={e => e.stopPropagation()}
                      >
                        <button className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 flex items-center gap-2"
                          onClick={() => { onReply(msg); setActiveMenuId(null); }}>
                          <Reply size={14} /> Reply
                        </button>
                        <button className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 flex items-center gap-2 border-t border-gray-100"
                          onClick={(e) => { e.stopPropagation(); setQuickReactMsgId(msg.id); setActiveMenuId(null); }}>
                          <SmilePlus size={14} /> React
                        </button>
                        <button className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 flex items-center gap-2 border-t border-gray-100"
                          onClick={() => { setForwardMessageId(msg.id); setActiveMenuId(null); }}>
                          <Forward size={14} /> Forward
                        </button>
                        {isMine && (
                          <>
                            <button className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 flex items-center gap-2 border-t border-gray-100"
                              onClick={() => { sendDeleteMessage(msg.id, 'me'); setActiveMenuId(null); }}>
                              <X size={14} /> Delete for me
                            </button>
                            <button className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2 border-t border-gray-100"
                              onClick={() => { sendDeleteMessage(msg.id, 'everyone'); setActiveMenuId(null); }}>
                              <Trash2 size={14} /> Delete for everyone
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {emojiPickerMsgId === msg.id && (
                      <div
                        ref={pickerRef}
                        className={`absolute bottom-full mb-2 ${isMine ? 'right-0' : 'left-0'} z-[200]`}
                        onClick={e => e.stopPropagation()}
                      >
                        <EmojiPickerModal
                          onSelect={(emoji) => {
                            sendReaction(msg.id, emoji);
                            saveRecentEmoji(emoji);
                            setEmojiPickerMsgId(null);
                          }}
                          onClose={() => setEmojiPickerMsgId(null)}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className={`flex items-center mt-1 text-xs text-gray-400 gap-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                <span>{format(new Date(msg.created_at), 'hh:mm a')}</span>
                {/* Always show double tick for sent messages, blue only if read AND allowed */}
                {isMine && (
                  isRead
                    ? <CheckCheck size={14} className="text-blue-500" />
                    : <CheckCheck size={14} className="text-gray-400" />
                )}
              </div>

              {(msg.reactions || []).length > 0 && (
                <div className={`flex gap-1 mt-1 flex-wrap ${isMine ? 'justify-end' : 'justify-start'}`}>
                  {(msg.reactions || []).map(r => (
                    <button
                      key={r.emoji}
                      onClick={(e) => { e.stopPropagation(); sendReaction(msg.id, r.emoji); }}
                      className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 border transition-transform hover:scale-110 active:scale-95 ${
                        r.user_reacted
                          ? 'bg-blue-100 border-blue-300 text-blue-700'
                          : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <span>{r.emoji}</span>
                      <span className="font-medium">{r.count}</span>
                    </button>
                  ))}
                </div>
              )}
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

      {forwardMessageId && (
        <ForwardModal
          messageId={Number(forwardMessageId)}
          onClose={() => setForwardMessageId(null)}
        />
      )}
    </div>
  );
};