'use client';

import { useState, useEffect } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { chatApi } from '@/services/api/chat';
import { User } from '@/types/chat';
import { useAuth } from '@/context/AuthContext';
import { Users, UserMinus, Shield, ShieldOff, Plus, Check, X } from 'lucide-react'; // Added X back

export const GroupManagement = ({ onClose }: { onClose: () => void }) => {
  const { conversations, activeConversationId, setConversations, onlineUsers } = useChatStore();
  const { user: currentUser } = useAuth();
  
  const [contacts, setContacts] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  const activeConversation = conversations.find(c => c.id === activeConversationId);

  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const data = await chatApi.getUsers();
        setContacts(data);
      } catch (error) {
        console.error("Failed to fetch users:", error);
      }
    };
    fetchContacts();
  }, []);

  if (!activeConversation) return null;

  const currentUserParticipant = activeConversation.participants.find(p => String(p.id) === String(currentUser?.id));
  const isCurrentUserAdmin = currentUserParticipant?.role === 'admin';

  const refreshConversations = async () => {
    try {
      const data = await chatApi.getConversations();
      setConversations(data);
    } catch (error) {
      console.error('Failed to reload conversations:', error);
    }
  };

  const handleAddMember = async (userId: number) => {
    if (!activeConversationId) return;
    setLoading(true);
    try {
      await chatApi.addMembers(activeConversationId, [userId]);
      await refreshConversations();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!activeConversationId) return;
    setLoading(true);
    try {
      await chatApi.removeMember(activeConversationId, userId);
      await refreshConversations();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePromoteAdmin = async (userId: number) => {
    if (!activeConversationId) return;
    setLoading(true);
    try {
      await chatApi.promoteAdmin(activeConversationId, userId);
      await refreshConversations();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAdmin = async (userId: number) => {
    if (!activeConversationId) return;
    setLoading(true);
    try {
      await chatApi.removeAdmin(activeConversationId, userId);
      await refreshConversations();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const nonMembers = contacts.filter(
    contact => !activeConversation.participants.some(p => String(p.id) === String(contact.id))
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-lg font-bold text-gray-800">Group Management</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 text-gray-500">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 h-full">
          <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Participants ({activeConversation.participants.length})</h3>
          <div className="flex flex-col gap-3 mb-6">
            {activeConversation.participants.map(p => {
              const isAdmin = p.role === 'admin';
              const isMe = String(p.id) === String(currentUser?.id);

              return (
                <div key={p.id} className="flex justify-between items-center group">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                        {p.username[0].toUpperCase()}
                      </div>
                      {onlineUsers.includes(p.id) && (
                        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></div>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                        {p.username} {isMe && <span className="text-xs text-gray-400 font-normal">(You)</span>}
                        {p.is_creator && <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] rounded border border-purple-200 uppercase font-bold tracking-wider">Creator</span>}
                        {isAdmin && !p.is_creator && <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] rounded border border-green-200 uppercase font-bold tracking-wider">Admin</span>}
                      </div>
                    </div>
                  </div>

                  {isCurrentUserAdmin && !isMe && !p.is_creator && (
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {isAdmin ? (
                        <button 
                          onClick={() => handleRemoveAdmin(p.id)}
                          disabled={loading}
                          className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-md transition-colors"
                          title="Remove Admin"
                        >
                          <Shield size={16} className="fill-orange-600 opacity-20" />
                        </button>
                      ) : (
                        <button 
                          onClick={() => handlePromoteAdmin(p.id)}
                          disabled={loading}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded-md transition-colors"
                          title="Make Admin"
                        >
                          <Shield size={16} />
                        </button>
                      )}
                      
                      <button 
                        onClick={() => handleRemoveMember(p.id)}
                        disabled={loading}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title="Remove from group"
                      >
                        <UserMinus size={16} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {isCurrentUserAdmin && nonMembers.length > 0 && (
            <>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3 border-t pt-4">Add Members</h3>
              <div className="flex flex-col gap-2">
                {nonMembers.map(contact => (
                  <div key={contact.id} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded-lg border border-transparent hover:border-gray-100 transition-all">
                    <div className="text-sm text-gray-700">{contact.username}</div>
                    <button 
                      onClick={() => handleAddMember(contact.id)}
                      disabled={loading}
                      className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1 rounded-md text-sm font-medium transition-colors flex items-center gap-1"
                    >
                      <Plus size={14} /> Add
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
