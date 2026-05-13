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
          .sort((a, b) => Number(b.pinned ?? false) - Number(a.pinned ?? false)),
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

  /** Best-effort title from thread metadata; falls back to a truncated id. */
  private toThread(t: SdkThread): Thread {
    const meta = (t.metadata ?? {}) as { title?: unknown; archived?: unknown; pinned?: unknown; projectId?: unknown };
    const customTitle = meta.title;
    const archived = meta.archived === true;
    const pinned = meta.pinned === true;
    const projectId = typeof meta.projectId === 'string' && meta.projectId.length > 0
      ? meta.projectId
      : null;
    return {
      id: t.thread_id,
      title: typeof customTitle === 'string' && customTitle.length > 0
        ? customTitle
        : `Thread ${t.thread_id.slice(0, 8)}`,
      status: archived ? 'archived' : 'active',
      pinned,
      projectId,
    };
  }
}
