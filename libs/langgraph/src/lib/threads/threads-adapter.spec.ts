// SPDX-License-Identifier: MIT
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  LangGraphThreadsAdapter,
  LANGGRAPH_THREADS_CONFIG,
  LANGGRAPH_CLIENT,
} from './threads-adapter';
import type { Client } from '@langchain/langgraph-sdk';

function mockClient(searchReturn: unknown[] = []): {
  client: Client;
  search: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
} {
  const search = vi.fn().mockResolvedValue(searchReturn);
  const update = vi.fn().mockResolvedValue(undefined);
  const del = vi.fn().mockResolvedValue(undefined);
  const create = vi.fn().mockResolvedValue({ thread_id: 'new-thread' });
  return {
    client: { threads: { search, update, delete: del, create } } as unknown as Client,
    search, update, del, create,
  };
}

function configure(client: Client, titleKey = 'thread_title'): LangGraphThreadsAdapter {
  TestBed.configureTestingModule({
    providers: [
      { provide: LANGGRAPH_THREADS_CONFIG, useValue: { apiUrl: 'http://x', titleMetadataKey: titleKey } },
      { provide: LANGGRAPH_CLIENT, useValue: client },
    ],
  });
  return TestBed.inject(LangGraphThreadsAdapter);
}

describe('LangGraphThreadsAdapter', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('maps SDK threads through the configured title metadata key', async () => {
    const { client } = mockClient([
      {
        thread_id: 't1',
        updated_at: '2026-05-20T00:00:00Z',
        metadata: { thread_title: 'Capital of Japan' },
      },
    ]);
    const svc = configure(client);
    await svc.refresh();
    expect(svc.threads()).toEqual([
      expect.objectContaining({ id: 't1', title: 'Capital of Japan', status: 'active', pinned: false }),
    ]);
  });

  it('honours an alternate title key (demo writes metadata.title)', async () => {
    const { client } = mockClient([
      { thread_id: 't1', metadata: { title: 'Hello' } },
    ]);
    const svc = configure(client, 'title');
    await svc.refresh();
    expect(svc.threads()[0].title).toBe('Hello');
  });

  it('falls back to "Untitled" when title metadata is missing', async () => {
    const { client } = mockClient([{ thread_id: 't1', metadata: {} }]);
    const svc = configure(client);
    await svc.refresh();
    expect(svc.threads()[0].title).toBe('Untitled');
  });

  it('partitions archived threads into archivedThreads()', async () => {
    const { client } = mockClient([
      { thread_id: 'a', metadata: {} },
      { thread_id: 'b', metadata: { archived: true } },
    ]);
    const svc = configure(client);
    await svc.refresh();
    expect(svc.threads().map(t => t.id)).toEqual(['a']);
    expect(svc.archivedThreads().map(t => t.id)).toEqual(['b']);
  });

  it('sorts pinned threads first (with pinnedOrder secondary sort)', async () => {
    const { client } = mockClient([
      { thread_id: 'unp', metadata: {} },
      { thread_id: 'p2', metadata: { pinned: true, pinnedOrder: 1 } },
      { thread_id: 'p1', metadata: { pinned: true, pinnedOrder: 0 } },
    ]);
    const svc = configure(client);
    await svc.refresh();
    expect(svc.threads().map(t => t.id)).toEqual(['p1', 'p2', 'unp']);
  });

  it('rename() writes the configured title key', async () => {
    const m = mockClient();
    const svc = configure(m.client, 'thread_title');
    await svc.rename('t1', 'New title');
    expect(m.update).toHaveBeenCalledWith('t1', { metadata: { thread_title: 'New title' } });
  });

  it('logs but does not throw when refresh() fails', async () => {
    const search = vi.fn().mockRejectedValue(new Error('boom'));
    const client = { threads: { search } } as unknown as Client;
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const svc = configure(client);
    await expect(svc.refresh()).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalledWith(
      '[LangGraphThreadsAdapter.refresh] failed:',
      expect.objectContaining({ message: 'boom' }),
    );
    errSpy.mockRestore();
  });
});
