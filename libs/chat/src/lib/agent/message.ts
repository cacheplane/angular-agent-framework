// SPDX-License-Identifier: MIT
import type { ContentBlock } from './content-block';

export type Role = 'user' | 'assistant' | 'system' | 'tool';

export interface Message {
  id: string;
  role: Role;
  /** Plain text, or a list of structured content blocks. */
  content: string | ContentBlock[];
  /** Present when role === 'tool'. */
  toolCallId?: string;
  /** Optional display/author name. */
  name?: string;
  /** Runtime-specific extras; do not rely on shape in portable code. */
  extra?: Record<string, unknown>;
}

export function isUserMessage(m: Message): m is Message & { role: 'user' } {
  return m.role === 'user';
}

export function isAssistantMessage(m: Message): m is Message & { role: 'assistant' } {
  return m.role === 'assistant';
}

export function isToolMessage(m: Message): m is Message & { role: 'tool' } {
  return m.role === 'tool';
}

export function isSystemMessage(m: Message): m is Message & { role: 'system' } {
  return m.role === 'system';
}
