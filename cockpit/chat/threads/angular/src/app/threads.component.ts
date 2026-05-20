// SPDX-License-Identifier: MIT
import { Component, effect, inject, signal } from '@angular/core';
import {
  ChatComponent,
  ChatThreadListComponent,
  type ThreadActionAdapter,
} from '@ngaf/chat';
import { agent } from '@ngaf/langgraph';
import { ExampleChatLayoutComponent } from '@ngaf/example-layouts';
import { environment } from '../environments/environment';
import { ThreadsService } from './threads.service';

/**
 * ThreadsComponent demonstrates multi-thread conversation management
 * backed by the real LangGraph SDK — mirrors the canonical demo's
 * shell/threads.service.ts wiring pattern (rename / delete / archive
 * action adapter + run-status refresh trigger). LLM-generated titles
 * surface via `metadata.thread_title`, written by the cap's
 * `generate_title` graph node on each thread's first turn.
 */
@Component({
  selector: 'app-threads',
  standalone: true,
  imports: [ChatComponent, ChatThreadListComponent, ExampleChatLayoutComponent],
  template: `
    <example-chat-layout sidebarPosition="left" sidebarWidth="w-64">
      <chat main
        [agent]="agent"
        [threads]="threadsSvc.threads()"
        [activeThreadId]="activeThreadId() ?? ''"
        (threadSelected)="onThreadSelected($event)"
        class="flex-1 min-w-0" />
      <div sidebar class="p-4 space-y-4"
           style="background: var(--ngaf-chat-bg); color: var(--ngaf-chat-text);">
        <div class="flex items-center justify-between">
          <h3 class="text-xs font-semibold uppercase tracking-wide"
              style="color: var(--ngaf-chat-text-muted);">Threads</h3>
          <button type="button"
                  class="text-xs underline"
                  style="color: var(--ngaf-chat-text-muted);"
                  (click)="onNewThread()">+ New</button>
        </div>
        <chat-thread-list
          [threads]="threadsSvc.threads()"
          [activeThreadId]="activeThreadId() ?? ''"
          [actions]="threadActions"
          (threadSelected)="onThreadSelected($event)" />
      </div>
    </example-chat-layout>
  `,
})
export class ThreadsComponent {
  protected readonly threadsSvc = inject(ThreadsService);

  /** Writable signal the agent watches — assigning to it switches the
   *  active thread without forcing a full agent rebuild. */
  protected readonly activeThreadId = signal<string | null>(null);

  protected readonly agent = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
    threadId: this.activeThreadId,
    // When the agent auto-creates a thread on first submit, the
    // adapter calls back with its id; mirror that into our signal so
    // the sidenav highlights it immediately.
    onThreadId: (id: string) => this.activeThreadId.set(id),
  });

  /** Action adapter: framework calls these on rename / delete / archive
   *  after confirmation. Service handles SDK round-trip + refresh. */
  protected readonly threadActions: ThreadActionAdapter = {
    delete: async (id) => {
      await this.threadsSvc.delete(id);
      if (this.activeThreadId() === id) this.activeThreadId.set(null);
    },
    rename: (id, title) => this.threadsSvc.rename(id, title),
    archive: async (id) => {
      await this.threadsSvc.archive(id);
      if (this.activeThreadId() === id) this.activeThreadId.set(null);
    },
    unarchive: (id) => this.threadsSvc.unarchive(id),
  };

  constructor() {
    // Initial fetch.
    void this.threadsSvc.refresh();

    // Re-fetch when an agent run completes. The graph's generate_title
    // node writes metadata.thread_title on the first turn; refreshing
    // on the running→idle transition surfaces it in the sidenav
    // without a manual reload.
    let lastStatus = this.agent.status();
    effect(() => {
      const status = this.agent.status();
      if (lastStatus === 'running' && status !== 'running') {
        void this.threadsSvc.refresh();
      }
      lastStatus = status;
    });
  }

  protected onThreadSelected(threadId: string): void {
    // switchThread is the LangGraph adapter's canonical thread-switch API
    // (resets derived state + reloads server messages for the new thread).
    this.agent.switchThread(threadId);
    this.activeThreadId.set(threadId);
  }

  protected async onNewThread(): Promise<void> {
    const id = await this.threadsSvc.create();
    if (id) {
      this.agent.switchThread(id);
      this.activeThreadId.set(id);
    }
  }
}
