// libs/chat/src/lib/styles/chat-message.styles.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { CHAT_MESSAGE_STYLES } from './chat-message.styles';

describe('CHAT_MESSAGE_STYLES — controls positioning', () => {
  const normalized = CHAT_MESSAGE_STYLES.replace(/\s+/g, ' ');
  it('does NOT absolute-position the actions controls (so they flow inside .chat-message__main, indented past the gutter)', () => {
    expect(normalized).not.toMatch(
      /\.chat-message__controls\s*\{[^}]*position:\s*absolute/,
    );
  });
  it('does NOT pin the controls to a negative bottom offset (would overlap with the next message)', () => {
    expect(normalized).not.toMatch(
      /\.chat-message__controls\s*\{[^}]*bottom:\s*-/,
    );
  });
});
