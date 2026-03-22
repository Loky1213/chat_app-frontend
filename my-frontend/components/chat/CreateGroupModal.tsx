'use client';

import { useState, useEffect } from 'react';
import { chatApi } from '@/services/api/chat';
import { User } from '@/types/chat';
import { X, Users, Check } from 'lucide-react';

export const CreateGroupModal = ({ 
  onClose, 
  onSuccess 
}: { 
  onClose: () => void;
  onSuccess: (conversationId: string) => void;
}) => {
  const [contacts, setContacts] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

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

  const toggleUserSelection = (userId: number) => {
    if (selectedUserIds.includes(userId)) {
      setSelectedUserIds(selectedUserIds.filter(id => id !== userId));
    } else {
      setSelectedUserIds([...selectedUserIds, userId]);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedUserIds.length === 0) return;
    
    setLoading(true);
    try {
      const response = await chatApi.createGroupChat(groupName, selectedUserIds);
      // Depending on API response structure, there might be conversation_id or id
      const convId = (response as any).conversation_id || (response as any).id;
      if (convId) {
        onSuccess(convId);
      } else {
        onClose(); // Fallback if no ID returned
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-2">
            <Users size={20} className="text-blue-600" />
            <h2 className="text-lg font-bold text-gray-800">Create New Group</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 text-gray-500">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 border-b border-gray-100">
          <label className="block text-sm font-medium text-gray-700 mb-1">Group Name</label>
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="e.g. Weekend Plans"
            className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg px-3 py-2 outline-none transition-all"
          />
        </div>

        <div className="p-4 overflow-y-auto flex-1 h-full min-h-[200px]">
          <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3 text-left">
            Select Members ({selectedUserIds.length})
          </h3>
          <div className="flex flex-col gap-2">
            {contacts.map(contact => {
              const isSelected = selectedUserIds.includes(contact.id);
              return (
                <div 
                  key={contact.id} 
                  onClick={() => toggleUserSelection(contact.id)}
                  className={`flex justify-between items-center p-3 rounded-lg border cursor-pointer transition-all ${
                    isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:bg-gray-50 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-bold flex-shrink-0">
                      {contact.username[0].toUpperCase()}
                    </div>
                    <div className="text-sm font-semibold text-gray-800">{contact.username}</div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                    isSelected ? 'border-blue-500 bg-blue-500 text-white' : 'border-gray-300 transparent'
                  }`}>
                    {isSelected && <Check size={12} strokeWidth={3} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors font-medium text-sm"
          >
            Cancel
          </button>
          <button 
            onClick={handleCreateGroup}
            disabled={loading || !groupName.trim() || selectedUserIds.length === 0}
            className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors font-medium text-sm"
          >
            {loading ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  );
};
