export interface User {
  id: number;
  username: string;
  email?: string;
  first_name?: string;
  last_name?: string;
}

export interface Message {
  id: string;
  content: string;
  message_type: 'text' | string;
  sender: User;
  created_at: string;
  read_by?: number[]; // list of user ids that have read this message
}

export interface Conversation {
  id: string;
  name: string;
  type: string;
  unread_count: number;
  participants: User[];
  last_message?: Message;
}
