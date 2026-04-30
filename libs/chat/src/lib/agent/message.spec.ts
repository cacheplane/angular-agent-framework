// SPDX-License-Identifier: MIT
import { isUserMessage, isAssistantMessage, type Message } from './message';

describe('Message', () => {
  it('isUserMessage narrows role', () => {
    const msg: Message = { id: '1', role: 'user', content: 'hi' };
    expect(isUserMessage(msg)).toBe(true);
    expect(isAssistantMessage(msg)).toBe(false);
  });

  it('isAssistantMessage narrows role', () => {
    const msg: Message = { id: '2', role: 'assistant', content: 'hello' };
    expect(isAssistantMessage(msg)).toBe(true);
    expect(isUserMessage(msg)).toBe(false);
  });
});
