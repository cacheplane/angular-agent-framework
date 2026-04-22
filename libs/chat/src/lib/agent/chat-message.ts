// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { ChatContentBlock } from './chat-content-block';

export type ChatRole = 'user' | 'assistant' | 'system' | 'tool';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  /** Plain text, or a list of structured content blocks. */
  content: string | ChatContentBlock[];
  /** Present when role === 'tool'. */
  toolCallId?: string;
  /** Optional display/author name. */
  name?: string;
  /** Runtime-specific extras; do not rely on shape in portable code. */
  extra?: Record<string, unknown>;
}

export function isUserMessage(m: ChatMessage): m is ChatMessage & { role: 'user' } {
  return m.role === 'user';
}

export function isAssistantMessage(m: ChatMessage): m is ChatMessage & { role: 'assistant' } {
  return m.role === 'assistant';
}

export function isToolMessage(m: ChatMessage): m is ChatMessage & { role: 'tool' } {
  return m.role === 'tool';
}

export function isSystemMessage(m: ChatMessage): m is ChatMessage & { role: 'system' } {
  return m.role === 'system';
}
