// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { signal } from '@angular/core';
import { getMessageType } from './chat-messages.component';
import { mockChatAgent } from '../../testing/mock-chat-agent';
import type { ChatMessage } from '../../agent';

describe('getMessageType', () => {
  it('maps user role to "human"', () => {
    const msg: ChatMessage = { id: '1', role: 'user', content: 'hello' };
    expect(getMessageType(msg)).toBe('human');
  });

  it('maps assistant role to "ai"', () => {
    const msg: ChatMessage = { id: '2', role: 'assistant', content: 'response' };
    expect(getMessageType(msg)).toBe('ai');
  });

  it('maps system role to "system"', () => {
    const msg: ChatMessage = { id: '3', role: 'system', content: 'system prompt' };
    expect(getMessageType(msg)).toBe('system');
  });

  it('maps tool role to "tool"', () => {
    const msg: ChatMessage = { id: '4', role: 'tool', content: 'result', toolCallId: 'call_1' };
    expect(getMessageType(msg)).toBe('tool');
  });

  it('falls back to "ai" for unknown roles', () => {
    const msg = { id: '5', role: 'unknown', content: '' } as unknown as ChatMessage;
    expect(getMessageType(msg)).toBe('ai');
  });
});

describe('ChatMessagesComponent — computed messages', () => {
  it('messages() signal reflects the agent messages signal', () => {
    const msgs: ChatMessage[] = [
      { id: '1', role: 'user', content: 'hi' },
      { id: '2', role: 'assistant', content: 'hello' },
    ];
    const agent = mockChatAgent({ messages: msgs });

    const agent$ = signal(agent);
    const messages = () => agent$().messages();

    expect(messages()).toHaveLength(2);
    expect(messages()[0].role).toBe('user');
    expect(messages()[1].role).toBe('assistant');
  });

  it('messages() updates reactively when agent messages change', () => {
    const agent = mockChatAgent({ messages: [] });
    const agent$ = signal(agent);
    const messages = () => agent$().messages();

    expect(messages()).toHaveLength(0);

    const updatedAgent = mockChatAgent({
      messages: [{ id: '1', role: 'user', content: 'new message' }],
    });
    agent$.set(updatedAgent);

    expect(messages()).toHaveLength(1);
  });
});

describe('ChatMessagesComponent — findTemplate logic', () => {
  it('findTemplate returns matching directive by type', () => {
    const templates = [
      { chatMessageTemplate: () => 'human' as const, templateRef: {} },
      { chatMessageTemplate: () => 'ai' as const, templateRef: {} },
    ];

    const findTemplate = (type: string) =>
      templates.find(t => t.chatMessageTemplate() === type);

    expect(findTemplate('human')).toBeDefined();
    expect(findTemplate('human')?.chatMessageTemplate()).toBe('human');
    expect(findTemplate('ai')).toBeDefined();
    expect(findTemplate('tool')).toBeUndefined();
  });

  it('findTemplate returns undefined when no templates registered', () => {
    const templates: { chatMessageTemplate: () => string }[] = [];
    const findTemplate = (type: string) =>
      templates.find(t => t.chatMessageTemplate() === type);

    expect(findTemplate('human')).toBeUndefined();
  });
});
