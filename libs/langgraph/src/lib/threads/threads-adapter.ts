// SPDX-License-Identifier: MIT
import { Injectable, InjectionToken, inject, signal, type Signal, type WritableSignal } from '@angular/core';
import type { Client, Thread as SdkThread } from '@langchain/langgraph-sdk';
import type { Thread } from '@ngaf/chat';
import { createLangGraphClient } from '../client/create-langgraph-client';

/**
 * Configuration consumed by {@link LangGraphThreadsAdapter}. Provide
 * via {@link LANGGRAPH_THREADS_CONFIG} (typically in app.config.ts):
 *
 * ```ts
 * providers: [
 *   { provide: LANGGRAPH_THREADS_CONFIG, useValue: {
 *       apiUrl: environment.langGraphApiUrl,
 *       titleMetadataKey: 'thread_title',
 *   }},
 * ],
 * ```
 */
export interface LangGraphThreadsConfig {
  /** Base URL for the LangGraph Platform API. Accepts both absolute
   *  URLs and relative `/api`-style paths. */
  apiUrl: string;
  /** Metadata key the backend writes the thread title to. Two
   *  conventions exist in the wild:
   *  - `'title'` — legacy / canonical demo
   *  - `'thread_title'` — spec 2026-05-19-llm-generated-labels-design
   *  Defaults to `'thread_title'`. */
  titleMetadataKey?: string;
  /** Fallback label for threads whose title hasn't been written yet
   *  (e.g. created but never sent). Defaults to `'Untitled'`. */
  titleFallback?: string;
}

export const LANGGRAPH_THREADS_CONFIG = new InjectionToken<LangGraphThreadsConfig>(
  'LANGGRAPH_THREADS_CONFIG',
);

/** Optional adapter clients can pass an explicit Client (e.g. for
 *  testing). When omitted, the adapter constructs one via
 *  {@link createLangGraphClient}. */
export const LANGGRAPH_CLIENT = new InjectionToken<Client>('LANGGRAPH_CLIENT');

/**
 * SDK-backed thread store. Wraps `client.threads.*` and maps SDK
 * threads to the framework's {@link Thread} type for direct use with
 * `<chat-thread-list>` / `<chat-sidenav>`.
 *
 * Consumers wire the framework's `ThreadActionAdapter` to instance
 * methods (rename/delete/archive/pin/...) so the right-click menu
 * round-trips through the LangGraph SDK without per-app boilerplate.
 *
 * @example
 * ```ts
 * const svc = inject(LangGraphThreadsAdapter);
 * const actions: ThreadActionAdapter = {
 *   rename: (id, t) => svc.rename(id, t),
 *   delete: (id) => svc.delete(id),
 * };
 * ```
 */
@Injectable({ providedIn: 'root' })
export class LangGraphThreadsAdapter {
  private readonly config = inject(LANGGRAPH_THREADS_CONFIG);
  private readonly client: Client = inject(LANGGRAPH_CLIENT, { optional: true })
    ?? createLangGraphClient(this.config.apiUrl);

  private readonly titleKey: string = this.config.titleMetadataKey ?? 'thread_title';
  private readonly fallback: string = this.config.titleFallback ?? 'Untitled';

  private readonly _threads: WritableSignal<Thread[]> = signal<Thread[]>([]);
  private readonly _archived: WritableSignal<Thread[]> = signal<Thread[]>([]);

  /** Active (non-archived) threads, sorted with pinned first. */
  readonly threads: Signal<Thread[]> = this._threads.asReadonly();
  /** Threads whose `metadata.archived === true`. */
  readonly archivedThreads: Signal<Thread[]> = this._archived.asReadonly();

  /** Fetch the latest thread list from the server. Failures are
   *  logged via `console.error` (not swallowed silently — silent
   *  catches have masked prod issues in the past). */
  async refresh(): Promise<void> {
    try {
      const list = await this.client.threads.search({ limit: 50 });
      const mapped = list.map((t) => this.toThread(t));
      this._threads.set(
        mapped
          .filter((t) => t.status !== 'archived')
          .sort((a, b) => {
            const aP = a.pinned === true;
            const bP = b.pinned === true;
            if (aP !== bP) return Number(bP) - Number(aP);
            if (aP && bP) {
              const aO = typeof a['pinnedOrder'] === 'number' ? (a['pinnedOrder'] as number) : Infinity;
              const bO = typeof b['pinnedOrder'] === 'number' ? (b['pinnedOrder'] as number) : Infinity;
              return aO - bO;
            }
            return 0;
          }),
      );
      this._archived.set(mapped.filter((t) => t.status === 'archived'));
    } catch (e) {
      console.error('[LangGraphThreadsAdapter.refresh] failed:', e);
    }
  }

  async create(metadata: Record<string, unknown> = {}): Promise<string | null> {
    try {
      const t = await this.client.threads.create({ metadata });
      await this.refresh();
      return t.thread_id;
    } catch (e) {
      console.error('[LangGraphThreadsAdapter.create] failed:', e);
      return null;
    }
  }

  async delete(threadId: string): Promise<void> {
    await this.client.threads.delete(threadId);
    await this.refresh();
  }

  async rename(threadId: string, newTitle: string): Promise<void> {
    await this.client.threads.update(threadId, { metadata: { [this.titleKey]: newTitle } });
    await this.refresh();
  }

  async archive(threadId: string): Promise<void> {
    await this.client.threads.update(threadId, { metadata: { archived: true } });
    await this.refresh();
  }

  async unarchive(threadId: string): Promise<void> {
    await this.client.threads.update(threadId, { metadata: { archived: false } });
    await this.refresh();
  }

  async pin(threadId: string): Promise<void> {
    await this.client.threads.update(threadId, { metadata: { pinned: true } });
    await this.refresh();
  }

  async unpin(threadId: string): Promise<void> {
    await this.client.threads.update(threadId, { metadata: { pinned: false } });
    await this.refresh();
  }

  async moveToProject(threadId: string, projectId: string | null): Promise<void> {
    await this.client.threads.update(threadId, { metadata: { projectId } });
    await this.refresh();
  }

  /** Re-stamp `metadata.pinnedOrder = 0,1,2,...` for the pinned slice
   *  to reflect the new ordering. */
  async reorderPinned(threadId: string, beforeId: string | null): Promise<void> {
    const current = this._threads().filter((t) => t.pinned === true);
    const moved = current.find((t) => t.id === threadId);
    if (!moved) return;
    const rest = current.filter((t) => t.id !== threadId);
    const next: Thread[] = [];
    for (const t of rest) {
      if (t.id === beforeId) next.push(moved);
      next.push(t);
    }
    if (beforeId === null) next.push(moved);

    await Promise.all(
      next.map((t, idx) =>
        this.client.threads.update(t.id, { metadata: { pinnedOrder: idx } }),
      ),
    );
    await this.refresh();
  }

  private toThread(t: SdkThread): Thread {
    const meta = (t.metadata ?? {}) as Record<string, unknown>;
    const rawTitle = meta[this.titleKey];
    const archived = meta['archived'] === true;
    const pinned = meta['pinned'] === true;
    const projectId = typeof meta['projectId'] === 'string' && (meta['projectId'] as string).length > 0
      ? (meta['projectId'] as string)
      : null;
    const pinnedOrder = typeof meta['pinnedOrder'] === 'number' ? (meta['pinnedOrder'] as number) : undefined;
    return {
      id: t.thread_id,
      title: typeof rawTitle === 'string' && rawTitle.length > 0 ? rawTitle : this.fallback,
      status: archived ? 'archived' : 'active',
      pinned,
      projectId,
      pinnedOrder,
      updatedAt: t.updated_at ? Date.parse(t.updated_at) : undefined,
    };
  }
}
