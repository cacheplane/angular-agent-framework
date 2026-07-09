// SPDX-License-Identifier: MIT
import { Component, inject, signal } from '@angular/core';
import {
  ChatComponent,
  ChatThreadListComponent,
  type ThreadActionAdapter,
} from '@threadplane/chat';
import { injectAgent, provideAgent, LangGraphThreadsAdapter, refreshOnRunEnd } from '@threadplane/langgraph';
import { ExampleChatLayoutComponent } from '@threadplane/example-layouts';
import { environment } from '../environments/environment';

// Writable signal the agent watches — assigning to it switches the active
// thread without forcing a full agent rebuild. Shared between the
// component-scoped provideAgent() config (threadId + onThreadId) and the
// component. Module scope is safe: each demo app bootstraps one
// ThreadsComponent instance.
const activeThreadIdState = signal<string | null>(null);

/**
 * ThreadsComponent demonstrates multi-thread conversation management
 * backed by the real LangGraph SDK. Consumes the shared
 * LangGraphThreadsAdapter from `@threadplane/langgraph` — same service the
 * canonical demo uses. Reads `metadata.title` written by this cap's
 * `generate_title` graph node (spec
 * 2026-05-19-llm-generated-labels-design.md, converged on `title`
 * after the original `thread_title` choice). See app.config.ts for
 * the LANGGRAPH_THREADS_CONFIG provider.
 */
@Component({
  selector: 'app-threads',
  standalone: true,
  imports: [ChatComponent, ChatThreadListComponent, ExampleChatLayoutComponent],
  // Scoped agent (Option B): threadId + onThreadId are per-instance, so the
  // agent is provided at the component rather than in app.config.ts.
  providers: [
    provideAgent({
      apiUrl: environment.langGraphApiUrl,
      assistantId: environment.streamingAssistantId,
      threadId: activeThreadIdState,
      // When the agent auto-creates a thread on first submit, the
      // adapter calls back with its id; mirror that into our signal so
      // the sidenav highlights it immediately.
      onThreadId: (id: string) => activeThreadIdState.set(id),
    }),
  ],
  template: `
    <example-chat-layout sidebarPosition="left" sidebarWidth="16rem">
      <chat main
        [agent]="agent"
        [threads]="threadsSvc.threads()"
        [activeThreadId]="activeThreadId() ?? ''"
        (threadSelected)="onThreadSelected($event)"
        class="flex-1 min-w-0" />
      <div sidebar class="panel">
        <div class="panel-header">
          <h3 class="cap">Threads</h3>
          <button type="button"
                  class="action-button"
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
  styles: [`
    .panel {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 1rem;
      background: var(--tplane-chat-bg);
      color: var(--tplane-chat-text);
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }

    .cap {
      margin: 0;
      color: var(--tplane-chat-text-muted);
      font-size: var(--tplane-chat-font-size-xs);
      font-weight: 700;
      letter-spacing: 0.12em;
      line-height: var(--tplane-chat-line-height-tight);
      text-transform: uppercase;
    }

    .action-button {
      padding: 0;
      border: 0;
      background: transparent;
      color: var(--tplane-chat-text-muted);
      cursor: pointer;
      font: inherit;
      font-size: var(--tplane-chat-font-size-xs);
      line-height: var(--tplane-chat-line-height-tight);
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    .action-button:hover {
      color: var(--tplane-chat-text);
    }
  `],
})
export class ThreadsComponent {
  protected readonly threadsSvc = inject(LangGraphThreadsAdapter);

  /** Writable signal the agent watches — assigning to it switches the
   *  active thread without forcing a full agent rebuild. */
  protected readonly activeThreadId = activeThreadIdState;

  protected readonly agent = injectAgent();

  /** Action adapter: framework calls these on rename / delete / archive
   *  after confirmation. Adapter handles SDK round-trip + refresh. */
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
    // node writes metadata.title on the first turn; refreshing
    // on the running→idle transition surfaces it in the sidenav
    // without a manual reload.
    refreshOnRunEnd(this.agent, () => this.threadsSvc.refresh());
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
