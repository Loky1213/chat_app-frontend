import { Message, User } from '@/types/chat';

/**
 * Normalizes a raw message from ANY source (REST API, WebSocket, forwarded)
 * into a consistent Message shape that is safe to render.
 *
 * Guarantees:
 * - msg.sender always exists as a User object
 * - msg.sender.id is always defined
 * - msg.read_by is always an array
 * - msg.reactions is always an array
 */
export function normalizeMessage(raw: any): Message {
  console.log("RAW MESSAGE:", raw);

  if (!raw) {
    console.warn('[normalizeMessage] Received null/undefined message');
    const fallback: Message = {
      id: `unknown_${Date.now()}`,
      content: '',
      message_type: 'text',
      sender: { id: 0, username: 'Unknown' },
      created_at: new Date().toISOString(),
      read_by: [],
      reactions: [],
    };
    console.log("NORMALIZED MESSAGE:", fallback);
    return fallback;
  }

  // Build a guaranteed sender object
  let sender: User;
  if (raw.sender && typeof raw.sender === 'object' && raw.sender.id !== undefined) {
    // Full sender object from REST API
    sender = raw.sender;
  } else if (raw.sender_id !== undefined) {
    // WebSocket flat format: only sender_id
    sender = {
      id: Number(raw.sender_id),
      username: raw.sender_username || raw.sender_name || 'User',
      ...(raw.sender_first_name ? { first_name: raw.sender_first_name } : {}),
      ...(raw.sender_last_name ? { last_name: raw.sender_last_name } : {}),
    };
  } else if (raw.sender && typeof raw.sender === 'number') {
    // Edge case: sender is just a numeric ID
    sender = { id: raw.sender, username: 'User' };
  } else {
    // Complete fallback
    console.warn('[normalizeMessage] No sender info found:', raw.id);
    sender = { id: 0, username: 'Unknown' };
  }

  // Normalize read_by from various backend shapes
  const readBy: number[] = Array.isArray(raw.read_by)
    ? raw.read_by
    : Array.isArray(raw.read_receipts)
      ? raw.read_receipts
      : Array.isArray(raw.seen_by)
        ? raw.seen_by
        : [];

  const result: Message = {
    id: String(raw.id ?? `unknown_${Date.now()}`),
    content: raw.content ?? '',
    message_type: raw.message_type ?? raw.type ?? 'text',
    sender,
    created_at: raw.created_at ?? raw.timestamp ?? new Date().toISOString(),
    read_by: readBy,
    is_deleted: raw.is_deleted ?? false,
    deleted_for_everyone: raw.deleted_for_everyone ?? false,
    is_forwarded: raw.is_forwarded ?? false,
    reply_to: raw.reply_to ?? null,
    reactions: Array.isArray(raw.reactions) ? raw.reactions : [],
  };

  console.log("NORMALIZED MESSAGE:", result);
  return result;
}

/**
 * Normalize an array of messages (used for REST API batch responses).
 */
export function normalizeMessages(rawMessages: any[]): Message[] {
  return (rawMessages || []).map(normalizeMessage);
}
