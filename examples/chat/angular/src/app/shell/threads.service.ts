// SPDX-License-Identifier: MIT
import { Injectable, signal } from '@angular/core';
import type { Thread } from '@ngaf/chat';

const API_URL = 'http://localhost:2024';

@Injectable({ providedIn: 'root' })
export class ThreadsService {
  readonly threads = signal<Thread[]>([]);

  async refresh(): Promise<void> {
    try {
      const res = await fetch(`${API_URL}/threads/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 50 }),
      });
      if (!res.ok) return;
      const list = await res.json() as Array<{ thread_id: string; metadata?: Record<string, unknown> }>;
      this.threads.set(list.map(t => ({
        id: t.thread_id,
        title: this.titleFor(t),
      })));
    } catch {
      // Backend may be down; leave threads as-is.
    }
  }

  async create(): Promise<string | null> {
    try {
      const res = await fetch(`${API_URL}/threads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) return null;
      const t = await res.json() as { thread_id: string };
      await this.refresh();
      return t.thread_id;
    } catch {
      return null;
    }
  }

  /** Best-effort title: first user message from the thread's checkpoint
   * if present in metadata, else a truncated thread id. */
  private titleFor(t: { thread_id: string; metadata?: Record<string, unknown> }): string {
    const meta = t.metadata ?? {};
    const customTitle = (meta as { title?: string }).title;
    if (typeof customTitle === 'string' && customTitle.length > 0) return customTitle;
    return `Thread ${t.thread_id.slice(0, 8)}`;
  }
}
