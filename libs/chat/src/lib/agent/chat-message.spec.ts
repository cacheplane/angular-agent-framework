// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { isUserMessage, isAssistantMessage, type ChatMessage } from './chat-message';

describe('ChatMessage', () => {
  it('isUserMessage narrows role', () => {
    const msg: ChatMessage = { id: '1', role: 'user', content: 'hi' };
    expect(isUserMessage(msg)).toBe(true);
    expect(isAssistantMessage(msg)).toBe(false);
  });

  it('isAssistantMessage narrows role', () => {
    const msg: ChatMessage = { id: '2', role: 'assistant', content: 'hello' };
    expect(isAssistantMessage(msg)).toBe(true);
    expect(isUserMessage(msg)).toBe(false);
  });
});
