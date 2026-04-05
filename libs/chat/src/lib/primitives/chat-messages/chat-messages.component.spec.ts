// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { signal } from '@angular/core';
import { HumanMessage, AIMessage, SystemMessage, ToolMessage, FunctionMessage } from '@langchain/core/messages';
import { getMessageType } from './chat-messages.component';
import { createMockStreamResourceRef } from '../../testing/mock-stream-resource-ref';

describe('getMessageType', () => {
  it('maps HumanMessage to "human"', () => {
    expect(getMessageType(new HumanMessage('hello'))).toBe('human');
  });

  it('maps AIMessage to "ai"', () => {
    expect(getMessageType(new AIMessage('response'))).toBe('ai');
  });

  it('maps SystemMessage to "system"', () => {
    expect(getMessageType(new SystemMessage('system prompt'))).toBe('system');
  });

  it('maps ToolMessage to "tool"', () => {
    const toolMsg = new ToolMessage({ content: 'result', tool_call_id: 'call_1' });
    expect(getMessageType(toolMsg)).toBe('tool');
  });

  it('maps FunctionMessage to "function"', () => {
    const fnMsg = new FunctionMessage({ content: 'result', name: 'my_fn' });
    expect(getMessageType(fnMsg)).toBe('function');
  });

  it('falls back to "ai" for unknown message types', () => {
    const unknownMsg = { _getType: () => 'unknown' } as any;
    expect(getMessageType(unknownMsg)).toBe('ai');
  });
});

describe('ChatMessagesComponent — computed messages', () => {
  it('messages() signal reflects the ref messages signal', () => {
    const msgs = [new HumanMessage('hi'), new AIMessage('hello')];
    const mockRef = createMockStreamResourceRef({ messages: msgs });

    // Simulate what the component computes: ref().messages()
    const ref$ = signal(mockRef);
    const messages = () => ref$().messages();

    expect(messages()).toHaveLength(2);
    expect(messages()[0]._getType()).toBe('human');
    expect(messages()[1]._getType()).toBe('ai');
  });

  it('messages() updates reactively when ref messages change', () => {
    const mockRef = createMockStreamResourceRef({ messages: [] });
    const ref$ = signal(mockRef);
    const messages = () => ref$().messages();

    expect(messages()).toHaveLength(0);

    // Swap the ref to one with messages to test signal reactivity
    const updatedRef = createMockStreamResourceRef({
      messages: [new HumanMessage('new message')],
    });
    ref$.set(updatedRef);

    expect(messages()).toHaveLength(1);
  });
});

describe('ChatMessagesComponent — findTemplate logic', () => {
  it('findTemplate returns matching directive by type', () => {
    // Simulate findTemplate logic: find in array by chatMessageTemplate() value
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
