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
  get: ReturnType<typeof vi.fn>;
} {
  const search = vi.fn().mockResolvedValue(searchReturn);
  const update = vi.fn().mockResolvedValue(undefined);
  const del = vi.fn().mockResolvedValue(undefined);
  const create = vi.fn().mockResolvedValue({ thread_id: 'new-thread' });
  const get = vi.fn();
  return {
    client: { threads: { search, update, delete: del, create, get } } as unknown as Client,
    search, update, del, create, get,
  };
}

function configure(client: Client): LangGraphThreadsAdapter {
  TestBed.configureTestingModule({
    providers: [
      { provide: LANGGRAPH_THREADS_CONFIG, useValue: { apiUrl: 'http://x' } },
      { provide: LANGGRAPH_CLIENT, useValue: client },
    ],
  });
  return TestBed.inject(LangGraphThreadsAdapter);
}

describe('LangGraphThreadsAdapter', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('maps SDK threads via metadata.title', async () => {
    const { client } = mockClient([
      {
        thread_id: 't1',
        updated_at: '2026-05-20T00:00:00Z',
        metadata: { title: 'Capital of Japan' },
      },
    ]);
    const svc = configure(client);
    await svc.refresh();
    expect(svc.threads()).toEqual([
      expect.objectContaining({ id: 't1', title: 'Capital of Japan', status: 'active', pinned: false }),
    ]);
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

  it('rename() writes metadata.title', async () => {
    const m = mockClient();
    const svc = configure(m.client);
    await svc.rename('t1', 'New title');
    expect(m.update).toHaveBeenCalledWith('t1', { metadata: { title: 'New title' } });
  });

  it('getThread() returns a mapped Thread when the SDK resolves', async () => {
    const m = mockClient();
    m.get.mockResolvedValue({
      thread_id: 'tx',
      updated_at: '2026-05-20T00:00:00Z',
      metadata: { title: 'hello' },
    });
    const svc = configure(m.client);
    const result = await svc.getThread('tx');
    expect(m.get).toHaveBeenCalledWith('tx');
    expect(result).toEqual(expect.objectContaining({ id: 'tx', title: 'hello' }));
  });

  it('getThread() returns null when the SDK throws a 404', async () => {
    const m = mockClient();
    const err = Object.assign(new Error('not found'), { status: 404 });
    m.get.mockRejectedValue(err);
    const svc = configure(m.client);
    expect(await svc.getThread('missing')).toBeNull();
  });

  it('getThread() returns null when 404 lives on response.status', async () => {
    const m = mockClient();
    const err = Object.assign(new Error('not found'), { response: { status: 404 } });
    m.get.mockRejectedValue(err);
    const svc = configure(m.client);
    expect(await svc.getThread('missing')).toBeNull();
  });

  it('getThread() rethrows non-404 errors so transport failures are visible', async () => {
    const m = mockClient();
    const err = Object.assign(new Error('server exploded'), { status: 500 });
    m.get.mockRejectedValue(err);
    const svc = configure(m.client);
    await expect(svc.getThread('any')).rejects.toThrow('server exploded');
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
