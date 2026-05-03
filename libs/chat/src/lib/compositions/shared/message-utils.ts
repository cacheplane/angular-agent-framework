// SPDX-License-Identifier: MIT
import type { BaseMessage } from '@langchain/core/messages';

/**
 * Extracts a human-readable string from a message's content.
 *
 * `BaseMessage.content` is `string | MessageContentComplex[]`. Reasoning-
 * capable models (OpenAI gpt-5/o-series, Anthropic) emit complex arrays of
 * typed blocks: `{type:'text',text}`, `{type:'reasoning',...}`, tool-use
 * blocks, etc. We render only the visible text portions and skip anything
 * else. Stringifying the whole array would dump raw JSON like
 * `[{"type":"text",...}]` into the chat bubble.
 */
export function messageContent(message: BaseMessage): string {
  return extractText(message.content);
}

function extractText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  let out = '';
  for (const block of content) {
    if (typeof block === 'string') {
      out += block;
      continue;
    }
    if (!isRecord(block)) continue;
    const t = block['type'];
    if (t === 'text' || t === 'output_text' || t === undefined) {
      const text = block['text'];
      if (typeof text === 'string') out += text;
    }
    // Skip reasoning, tool_use, image, etc. — not chat-bubble content.
  }
  return out;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
