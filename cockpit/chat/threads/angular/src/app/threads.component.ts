// SPDX-License-Identifier: MIT
import { Component, effect, signal } from '@angular/core';
import { ChatComponent, ChatThreadListComponent, type Thread } from '@ngaf/chat';
import { agent } from '@ngaf/langgraph';
import { ExampleChatLayoutComponent } from '@ngaf/example-layouts';
import { Client } from '@langchain/langgraph-sdk';
import { environment } from '../environments/environment';

/**
 * ThreadsComponent demonstrates multi-thread conversation management
 * backed by real LangGraph SDK thread metadata — NOT hardcoded fake
 * threads. On init we fetch all threads via `client.threads.search()`
 * and map `metadata.thread_title` (populated by the cap's
 * `generate_title` graph node on each thread's first turn) to the
 * sidenav's `Thread.title` field. Refreshes after every agent turn so
 * newly-titled threads appear without a page reload.
 */
@Component({
  selector: 'app-threads',
  standalone: true,
  imports: [ChatComponent, ChatThreadListComponent, ExampleChatLayoutComponent],
  template: `
    <example-chat-layout sidebarPosition="left" sidebarWidth="w-64">
      <chat main
        [agent]="agent"
        [threads]="threads()"
        [activeThreadId]="activeThreadId() ?? ''"
        (threadSelected)="onThreadSelected($event)"
        class="flex-1 min-w-0" />
      <div sidebar class="p-4 space-y-4"
           style="background: var(--ngaf-chat-bg); color: var(--ngaf-chat-text);">
        <h3 class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--ngaf-chat-text-muted);">Threads</h3>
        <chat-thread-list
          [threads]="threads()"
          [activeThreadId]="activeThreadId() ?? ''"
          (threadSelected)="onThreadSelected($event)" />
      </div>
    </example-chat-layout>
  `,
})
export class ThreadsComponent {
  /** Writable signal the agent watches — assigning to it switches the
   *  active thread without forcing a full agent rebuild. */
  protected readonly activeThreadId = signal<string | null>(null);

  protected readonly agent = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
    threadId: this.activeThreadId,
  });

  /** Loaded from LangGraph SDK; refreshed after every agent turn so new
   *  threads + LLM-generated titles appear without a page reload. */
  protected readonly threads = signal<Thread[]>([]);

  /** LangGraph SDK client. Shares the same apiUrl the agent uses
   *  (via Angular's proxy.conf in dev / deployment URL in prod). */
  private readonly client = new Client({ apiUrl: environment.langGraphApiUrl });

  constructor() {
    // Initial fetch.
    void this.refreshThreads();

    // Re-fetch whenever the agent stops loading (each turn completes).
    // New threads get auto-titled by the graph's generate_title node;
    // this surfaces them in the sidenav without a manual refresh.
    let wasLoading = false;
    effect(() => {
      const loading = this.agent.isLoading();
      if (wasLoading && !loading) {
        void this.refreshThreads();
      }
      wasLoading = loading;
    });
  }

  /** Fetch all threads from LangGraph, mapping `metadata.thread_title`
   *  (set by the cap's `generate_title` graph node) onto `Thread.title`
   *  for the sidenav. Falls back to a UUID-slice for brand-new threads
   *  whose first turn hasn't completed yet. */
  protected async refreshThreads(): Promise<void> {
    try {
      const rows = await this.client.threads.search({ limit: 50 });
      const mapped: Thread[] = rows.map(t => ({
        id: t.thread_id,
        title:
          typeof (t.metadata as { thread_title?: unknown } | null)?.thread_title === 'string'
            ? (t.metadata as { thread_title: string }).thread_title
            : t.thread_id.slice(0, 8),
        updatedAt: t.updated_at ? Date.parse(t.updated_at) : undefined,
      }));
      this.threads.set(mapped);
    } catch (err) {
      // Best-effort — don't crash the UI if the SDK call fails (e.g.
      // dev server still booting). Sidenav stays empty until next refresh.
      console.warn('[c-threads] threads.search failed', err);
    }
  }

  protected onThreadSelected(threadId: string): void {
    // switchThread is the LangGraph adapter's canonical thread-switch API
    // (resets derived state + reloads server messages for the new thread).
    this.agent.switchThread(threadId);
    this.activeThreadId.set(threadId);
  }
}
