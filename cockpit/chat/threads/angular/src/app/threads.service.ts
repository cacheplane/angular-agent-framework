// SPDX-License-Identifier: MIT
import { Injectable, signal } from '@angular/core';
import { Client, type Thread as SdkThread } from '@langchain/langgraph-sdk';
import type { Thread } from '@ngaf/chat';
import { environment } from '../environments/environment';

/**
 * SDK-backed thread store for the c-threads cap.
 *
 * Mirrors the canonical demo's ThreadsService (examples/chat/angular/
 * src/app/shell/threads.service.ts) — the same pattern is duplicated
 * across consumers because we don't yet expose a shared
 * `LangGraphThreadsAdapter` from `@ngaf/langgraph`. See the DX notes
 * in the PR description for the planned hoist.
 *
 * Reads `metadata.thread_title` (written by the cap's `generate_title`
 * graph node — spec 2026-05-19-llm-generated-labels-design.md), not
 * `metadata.title` like the demo. The two backends will be converged
 * in a follow-up.
 */

/** SDK requires an absolute URL; rewrite `/api`-style relative paths
 *  against `window.location.origin` (matches the streaming transport
 *  in fetch-stream.transport.ts). */
function toAbsoluteApiUrl(apiUrl: string): string {
  if (apiUrl.startsWith('http://') || apiUrl.startsWith('https://')) return apiUrl;
  return typeof window !== 'undefined' ? `${window.location.origin}${apiUrl}` : apiUrl;
}

@Injectable({ providedIn: 'root' })
export class ThreadsService {
  private readonly client = new Client({ apiUrl: toAbsoluteApiUrl(environment.langGraphApiUrl) });

  readonly threads = signal<Thread[]>([]);
  readonly archivedThreads = signal<Thread[]>([]);

  async refresh(): Promise<void> {
    try {
      const list = await this.client.threads.search({ limit: 50 });
      const mapped = list.map((t) => this.toThread(t));
      this.threads.set(mapped.filter((t) => t.status !== 'archived'));
      this.archivedThreads.set(mapped.filter((t) => t.status === 'archived'));
    } catch {
      // Backend may be down; leave signals as-is.
    }
  }

  async create(): Promise<string | null> {
    try {
      const t = await this.client.threads.create();
      await this.refresh();
      return t.thread_id;
    } catch {
      return null;
    }
  }

  async delete(threadId: string): Promise<void> {
    await this.client.threads.delete(threadId);
    await this.refresh();
  }

  async rename(threadId: string, newTitle: string): Promise<void> {
    await this.client.threads.update(threadId, { metadata: { thread_title: newTitle } });
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

  /** Best-effort title from thread metadata. Falls back to "Untitled"
   *  for brand-new threads where the generate_title node hasn't run
   *  yet (matches the demo's convention — easier on the eye than a
   *  UUID slice). */
  private toThread(t: SdkThread): Thread {
    const meta = (t.metadata ?? {}) as { thread_title?: unknown; archived?: unknown };
    const title = meta.thread_title;
    const archived = meta.archived === true;
    return {
      id: t.thread_id,
      title: typeof title === 'string' && title.length > 0 ? title : 'Untitled',
      status: archived ? 'archived' : 'active',
      updatedAt: t.updated_at ? Date.parse(t.updated_at) : undefined,
    };
  }
}
