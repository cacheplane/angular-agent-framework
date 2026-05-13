// SPDX-License-Identifier: MIT
import { Injectable, signal } from '@angular/core';
import { Client, type Thread as SdkThread } from '@langchain/langgraph-sdk';
import type { Thread } from '@ngaf/chat';

const API_URL = 'http://localhost:2024';

@Injectable({ providedIn: 'root' })
export class ThreadsService {
  private readonly client = new Client({ apiUrl: API_URL });

  readonly threads = signal<Thread[]>([]);
  readonly archivedThreads = signal<Thread[]>([]);

  async refresh(): Promise<void> {
    try {
      const list = await this.client.threads.search({ limit: 50 });
      const mapped = list.map((t) => this.toThread(t));
      this.threads.set(
        mapped
          .filter((t) => t.status !== 'archived')
          .sort((a, b) => {
            const aPinned = a.pinned === true;
            const bPinned = b.pinned === true;
            if (aPinned !== bPinned) return Number(bPinned) - Number(aPinned);
            if (aPinned && bPinned) {
              const aOrd = typeof a.pinnedOrder === 'number' ? a.pinnedOrder : Infinity;
              const bOrd = typeof b.pinnedOrder === 'number' ? b.pinnedOrder : Infinity;
              return aOrd - bOrd;
            }
            return 0;
          }),
      );
      this.archivedThreads.set(mapped.filter((t) => t.status === 'archived'));
    } catch {
      // Backend may be down; leave signals as-is.
    }
  }

  async create(projectId?: string): Promise<string | null> {
    try {
      const t = await this.client.threads.create({
        metadata: projectId !== undefined ? { projectId } : {},
      });
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
    await this.client.threads.update(threadId, { metadata: { title: newTitle } });
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

  async moveToProject(threadId: string, projectId: string | null): Promise<void> {
    await this.client.threads.update(threadId, { metadata: { projectId } });
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

  async reorderPinned(threadId: string, beforeId: string | null): Promise<void> {
    const current = this.threads().filter((t) => t.pinned === true);
    const moved = current.find((t) => t.id === threadId);
    if (!moved) return;
    const rest = current.filter((t) => t.id !== threadId);
    const next: Thread[] = [];
    for (const t of rest) {
      if (t.id === beforeId) next.push(moved);
      next.push(t);
    }
    if (beforeId === null) next.push(moved);

    // Re-stamp metadata.pinnedOrder = 0,1,2,... in the desired order.
    await Promise.all(
      next.map((t, idx) =>
        this.client.threads.update(t.id, { metadata: { pinnedOrder: idx } }),
      ),
    );
    await this.refresh();
  }

  /** Best-effort title from thread metadata.
   *
   * The backend writes `metadata.title` from the first user message in a
   * thread (see `_maybe_write_thread_title` in the Python graph). Threads
   * created but never sent (e.g. via "+ New chat" then abandoned) have
   * no title, so we fall back to "Untitled" — easier on the eye than
   * the raw `Thread 019e1e98` id prefix, and consistent with how other
   * chat apps surface drafts.
   */
  private toThread(t: SdkThread): Thread {
    const meta = (t.metadata ?? {}) as { title?: unknown; archived?: unknown; pinned?: unknown; projectId?: unknown; pinnedOrder?: unknown };
    const customTitle = meta.title;
    const archived = meta.archived === true;
    const pinned = meta.pinned === true;
    const projectId = typeof meta.projectId === 'string' && meta.projectId.length > 0
      ? meta.projectId
      : null;
    const pinnedOrder = typeof meta.pinnedOrder === 'number' ? meta.pinnedOrder : undefined;
    return {
      id: t.thread_id,
      title: typeof customTitle === 'string' && customTitle.length > 0
        ? customTitle
        : 'Untitled',
      status: archived ? 'archived' : 'active',
      pinned,
      projectId,
      pinnedOrder,
    };
  }
}
