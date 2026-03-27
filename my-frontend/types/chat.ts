export interface User {
  id: number;
  username: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  role?: string; // e.g., 'admin', 'member' in group context
  is_online?: boolean; // Instantly tells us if the user is online
  is_creator?: boolean; // Protects the creator from being demoted or removed
}

export interface Message {
  id: string;
  content: string;
  message_type: 'text' | string;
  sender: User;
  created_at: string;
  read_by?: number[]; // list of user ids that have read this message
  is_deleted?: boolean;
  deleted_for_everyone?: boolean;
  is_forwarded?: boolean;
  reply_to?: {
    id: string;
    content: string;
    sender_id: string;
    sender_username: string;
  } | null;
  reactions?: {
    emoji: string;
    count: number;
    user_reacted: boolean;
  }[];
}

export interface Conversation {
  id: string;
  name: string;
  type: string;
  unread_count: number;
  participants: User[];
  last_message?: Message;
}
