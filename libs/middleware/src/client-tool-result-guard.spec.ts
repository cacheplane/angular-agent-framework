// SPDX-License-Identifier: MIT
import { AIMessage, HumanMessage, ToolMessage } from '@langchain/core/messages';
import { describe, expect, it } from 'vitest';
import { createInMemoryClientToolExecutionStore } from './langgraph/client-tool-execution-store';
import {
  extractClientToolResultMessages,
  filterDuplicateClientToolResultMessages,
  lookupClientToolExecutions,
  recordClientToolResults,
} from './langgraph/client-tool-result-guard';

describe('extractClientToolResultMessages', () => {
  it('extracts tool_call_id from a LangChain ToolMessage', () => {
    const [entry] = extractClientToolResultMessages([
      new ToolMessage({ content: '{"temp":72}', tool_call_id: 'call-1' }),
    ]);

    expect(entry).toEqual({
      toolCallId: 'call-1',
      result: { ok: true, value: { temp: 72 } },
    });
  });

  it('converts error content to an error result', () => {
    const [entry] = extractClientToolResultMessages([
      new ToolMessage({ content: 'Error: boom', tool_call_id: 'call-err' }),
    ]);

    expect(entry.result).toEqual({ ok: false, error: 'boom' });
  });

  it('converts plain text content to an ok string result', () => {
    const [entry] = extractClientToolResultMessages([
      new ToolMessage({ content: 'plain text', tool_call_id: 'call-text' }),
    ]);

    expect(entry.result).toEqual({ ok: true, value: 'plain text' });
  });

  it('ignores non-tool messages and tool messages without an id', () => {
    expect(extractClientToolResultMessages([
      new HumanMessage('hi'),
      new AIMessage('hello'),
      new ToolMessage({ content: 'x', tool_call_id: '' }),
    ])).toEqual([]);
  });
});

describe('recordClientToolResults', () => {
  it('claims and records first-seen result ids', async () => {
    const store = createInMemoryClientToolExecutionStore();
    const messages = [new ToolMessage({ content: '{"ok":true}', tool_call_id: 'call-1' })];

    await expect(recordClientToolResults({
      threadId: 'thread-1',
      messages,
      store,
    })).resolves.toEqual({
      recordedToolCallIds: ['call-1'],
      duplicateToolCallIds: [],
    });

    await expect(store.lookup('thread-1', ['call-1'])).resolves.toEqual({
      'call-1': { status: 'done', result: { ok: true, value: { ok: true } } },
    });
  });

  it('reports duplicate done ids without overwriting the first result', async () => {
    const store = createInMemoryClientToolExecutionStore();
    const first = [new ToolMessage({ content: '{"first":true}', tool_call_id: 'call-1' })];
    const second = [new ToolMessage({ content: '{"second":true}', tool_call_id: 'call-1' })];

    await recordClientToolResults({ threadId: 'thread-1', messages: first, store });

    await expect(recordClientToolResults({
      threadId: 'thread-1',
      messages: second,
      store,
    })).resolves.toEqual({
      recordedToolCallIds: [],
      duplicateToolCallIds: ['call-1'],
    });

    await expect(store.lookup('thread-1', ['call-1'])).resolves.toEqual({
      'call-1': { status: 'done', result: { ok: true, value: { first: true } } },
    });
  });
});

describe('filterDuplicateClientToolResultMessages', () => {
  it('removes only duplicate tool-result messages and keeps order for the rest', () => {
    const human = new HumanMessage('hi');
    const duplicate = new ToolMessage({ content: 'dup', tool_call_id: 'call-1' });
    const fresh = new ToolMessage({ content: 'fresh', tool_call_id: 'call-2' });

    expect(filterDuplicateClientToolResultMessages({
      messages: [human, duplicate, fresh],
      duplicateToolCallIds: new Set(['call-1']),
    })).toEqual([human, fresh]);
  });
});

describe('lookupClientToolExecutions', () => {
  it('delegates reload reconciliation to the store lookup', async () => {
    const store = createInMemoryClientToolExecutionStore();
    await recordClientToolResults({
      threadId: 'thread-1',
      messages: [new ToolMessage({ content: '{"done":true}', tool_call_id: 'call-1' })],
      store,
    });

    await expect(lookupClientToolExecutions({
      threadId: 'thread-1',
      toolCallIds: ['call-1', 'missing'],
      store,
    })).resolves.toEqual({
      'call-1': { status: 'done', result: { ok: true, value: { done: true } } },
    });
  });
});
