// SPDX-License-Identifier: MIT
import type { ContentBlock } from './content-block';
import type { Citation } from './citation';

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
  /**
   * Reasoning text emitted by the model before/alongside the visible
   * response. Populated by adapters from {type:'reasoning'} or
   * {type:'thinking'} content blocks (LangGraph) or REASONING_MESSAGE_*
   * events (AG-UI). Always a plain string — provider-specific shape
   * (encrypted blocks, multi-step summaries) is absorbed by the adapter
   * and not surfaced here.
   */
  reasoning?: string;
  /**
   * Wall-clock duration of the reasoning phase in milliseconds.
   * Populated by the adapter when both start (first reasoning chunk) and
   * end (first response-text chunk, or final canonical message) are
   * known. Undefined when reasoning timing isn't available.
   */
  reasoningDurationMs?: number;
  /** Runtime-specific extras; do not rely on shape in portable code. */
  extra?: Record<string, unknown>;
  /** Provider-agnostic citation list. Populated by adapters. */
  citations?: Citation[];
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
