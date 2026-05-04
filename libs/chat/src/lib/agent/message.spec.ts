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

describe('Message — reasoning fields', () => {
  it('accepts an optional reasoning string', () => {
    const m: Message = {
      id: 'a',
      role: 'assistant',
      content: 'hello',
      reasoning: 'first I thought about it',
    };
    expect(m.reasoning).toBe('first I thought about it');
  });

  it('accepts an optional reasoningDurationMs number', () => {
    const m: Message = {
      id: 'a',
      role: 'assistant',
      content: 'hello',
      reasoning: 'first I thought about it',
      reasoningDurationMs: 1234,
    };
    expect(m.reasoningDurationMs).toBe(1234);
  });

  it('treats both reasoning fields as optional', () => {
    const m: Message = { id: 'a', role: 'assistant', content: 'hello' };
    expect(m.reasoning).toBeUndefined();
    expect(m.reasoningDurationMs).toBeUndefined();
  });
});
