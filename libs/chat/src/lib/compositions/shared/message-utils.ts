// SPDX-License-Identifier: MIT
import type { BaseMessage } from '@langchain/core/messages';

/**
 * Extracts a human-readable string from a message's content.
 * Handles string content directly; serializes structured (array) content to JSON.
 */
export function messageContent(message: BaseMessage): string {
  const content = message.content;
  if (typeof content === 'string') return content;
  return JSON.stringify(content);
}
