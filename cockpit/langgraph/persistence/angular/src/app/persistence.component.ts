// SPDX-License-Identifier: MIT
import { Component, signal } from '@angular/core';
import { ChatComponent, ChatWelcomeSuggestionComponent } from '@threadplane/chat';
import { injectAgent, provideAgent } from '@threadplane/langgraph';
import { ExampleChatLayoutComponent } from '@threadplane/example-layouts';
import { environment } from '../environments/environment';

const WELCOME_SUGGESTIONS = [
  {
    label: 'Start a saved thread',
    value: 'Help me draft a project brief I can revisit.',
    description: 'Each reply gets a thread ID; click the sidebar to switch between conversations.',
  },
] as const;

interface Thread {
  id: string;
  label: string;
}

// Per-instance thread bookkeeping shared between the component-scoped
// provideAgent() config (which owns the onThreadId callback) and the
// component itself. Module scope is safe here: each demo app bootstraps a
// single PersistenceComponent instance.
const threadsState = signal<Thread[]>([]);
const activeThreadIdState = signal<string | null>(null);
let threadCounter = 0;

/**
 * PersistenceComponent demonstrates thread persistence with `injectAgent()`.
 *
 * Layout: a full-height flex row with the `<chat>` area (flex-1) on the left
 * and a fixed-width thread-picker sidebar on the right.
 *
 * Key integration points:
 * - `onThreadId` callback captures new thread IDs for the sidebar list
 * - `switchThread(id)` resumes a previous conversation
 * - `newThread()` starts a fresh conversation
 */
@Component({
  selector: 'app-persistence',
  standalone: true,
  imports: [ChatComponent, ChatWelcomeSuggestionComponent, ExampleChatLayoutComponent],
  // Scoped agent: the onThreadId callback tracks new thread ids into the
  // module-scoped signals the sidebar reads. Provided at the component (Option
  // B) because the config is genuinely per-instance.
  providers: [
    provideAgent({
      apiUrl: environment.langGraphApiUrl,
      assistantId: environment.streamingAssistantId,
      onThreadId: (id: string) => {
        activeThreadIdState.set(id);

        // Only add if not already tracked
        const existing = threadsState();
        if (!existing.some((t) => t.id === id)) {
          threadCounter++;
          threadsState.set([
            ...existing,
            { id, label: `Thread ${threadCounter}` },
          ]);
        }
      },
    }),
  ],
  template: `
    <example-chat-layout sidebarWidth="w-56">
      <chat main [agent]="agent" class="block flex-1 min-w-0">
        <div chatWelcomeSuggestions>
          @for (s of suggestions; track s.value) {
            <chat-welcome-suggestion
              [label]="s.label"
              [value]="s.value"
              [description]="s.description"
              (selected)="send($event)"
            />
          }
        </div>
      </chat>

      <div sidebar
        class="flex flex-col"
        style="background: var(--tplane-chat-surface-alt); color: var(--tplane-chat-text);"
      >
        <div
          class="px-3 py-2 text-xs font-semibold uppercase tracking-wide border-b"
          style="border-color: var(--tplane-chat-separator); color: var(--tplane-chat-text-muted)"
        >
          Threads
        </div>

        <div class="flex-1 overflow-y-auto">
          @for (thread of threads(); track thread.id) {
            <button
              class="w-full text-left px-3 py-2 text-sm truncate transition-colors"
              [class.font-semibold]="thread.id === activeThreadId()"
              [style.background]="thread.id === activeThreadId() ? 'var(--tplane-chat-surface-alt)' : 'transparent'"
              (mouseenter)="$event.currentTarget.style.background = 'var(--tplane-chat-surface-alt)'"
              (mouseleave)="$event.currentTarget.style.background = thread.id === activeThreadId() ? 'var(--tplane-chat-surface-alt)' : 'transparent'"
              (click)="switchThread(thread.id)"
            >
              {{ thread.label }}
            </button>
          }
        </div>

        <div class="p-2 border-t" style="border-color: var(--tplane-chat-separator)">
          <button
            class="w-full rounded px-3 py-1.5 text-sm font-medium transition-colors"
            style="background: var(--tplane-chat-surface-alt); color: var(--tplane-chat-text);"
            (mouseenter)="$event.currentTarget.style.opacity = '0.8'"
            (mouseleave)="$event.currentTarget.style.opacity = '1'"
            (click)="newThread()"
          >
            + New Thread
          </button>
        </div>
      </div>
    </example-chat-layout>
  `,
})
export class PersistenceComponent {
  protected readonly threads = threadsState;
  protected readonly activeThreadId = activeThreadIdState;
  protected readonly suggestions = WELCOME_SUGGESTIONS;

  /**
   * The streaming resource with thread persistence.
   *
   * The `onThreadId` callback (wired at the component-scoped provideAgent in
   * the decorator) fires when a new thread is created, tracking thread IDs for
   * the sidebar picker.
   */
  protected readonly agent = injectAgent();

  protected send(text: string): void {
    void this.agent.submit({ message: text });
  }

  /** Switch to an existing thread by ID. */
  switchThread(id: string): void {
    this.activeThreadId.set(id);
    this.agent.switchThread(id);
  }

  /** Start a brand-new thread. */
  newThread(): void {
    this.activeThreadId.set(null);
    this.agent.switchThread(null);
  }
}
