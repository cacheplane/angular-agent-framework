// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { createInMemoryClientToolExecutionStore } from './langgraph/client-tool-execution-store';
import type { ClientToolExecutionRecord, ClientToolResult } from './langgraph/client-tool-execution-store';

const key = { threadId: 'thread-1', toolCallId: 'call-1' };
const result: ClientToolResult = { ok: true, value: { temp: 72 } };

describe('createInMemoryClientToolExecutionStore', () => {
  it('claims a new tool-call execution', async () => {
    const store = createInMemoryClientToolExecutionStore();

    await expect(store.claim(key)).resolves.toBe('claimed');
  });

  it('returns executing for a second claim before a result is recorded', async () => {
    const store = createInMemoryClientToolExecutionStore();

    await store.claim(key);

    await expect(store.claim(key)).resolves.toEqual({ status: 'executing' });
  });

  it('returns the stored done result after record', async () => {
    const store = createInMemoryClientToolExecutionStore();

    await store.claim(key);
    await store.record(key, result);

    await expect(store.claim(key)).resolves.toEqual({ status: 'done', result });
  });

  it('looks up only requested known records', async () => {
    const store = createInMemoryClientToolExecutionStore();
    await store.claim(key);
    await store.record(key, result);
    await store.claim({ threadId: 'thread-1', toolCallId: 'call-2' });

    await expect(store.lookup('thread-1', ['call-1', 'missing'])).resolves.toEqual({
      'call-1': { status: 'done', result },
    });
  });

  it('does not expose mutable internal records through lookup', async () => {
    const store = createInMemoryClientToolExecutionStore();
    await store.claim(key);
    await store.record(key, result);

    const first = await store.lookup('thread-1', ['call-1']);
    (first['call-1'] as ClientToolExecutionRecord).status = 'failed';

    await expect(store.lookup('thread-1', ['call-1'])).resolves.toEqual({
      'call-1': { status: 'done', result },
    });
  });
});
