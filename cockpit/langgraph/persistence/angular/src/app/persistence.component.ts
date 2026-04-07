import { Component, signal } from '@angular/core';
import { ChatComponent } from '@cacheplane/chat';
import { agent } from '@cacheplane/angular';
import { environment } from '../environments/environment';

interface Thread {
  id: string;
  label: string;
}

/**
 * PersistenceComponent demonstrates thread persistence with `agent()`.
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
  imports: [ChatComponent],
  styles: `
    :host {
      display: flex;
      height: 100vh;
    }
  `,
  template: `
    <chat [ref]="stream" class="block flex-1 min-w-0" />

    <aside
      class="w-56 flex flex-col border-l"
      style="
        border-color: var(--chat-border);
        background: var(--chat-bg-alt);
        color: var(--chat-text);
      "
    >
      <div
        class="px-3 py-2 text-xs font-semibold uppercase tracking-wide border-b"
        style="border-color: var(--chat-border); color: var(--chat-text-muted)"
      >
        Threads
      </div>

      <div class="flex-1 overflow-y-auto">
        @for (thread of threads(); track thread.id) {
          <button
            class="w-full text-left px-3 py-2 text-sm truncate transition-colors"
            [class.font-semibold]="thread.id === activeThreadId()"
            [style.background]="thread.id === activeThreadId() ? 'var(--chat-bg-hover)' : 'transparent'"
            (mouseenter)="$event.currentTarget.style.background = 'var(--chat-bg-hover)'"
            (mouseleave)="$event.currentTarget.style.background = thread.id === activeThreadId() ? 'var(--chat-bg-hover)' : 'transparent'"
            (click)="switchThread(thread.id)"
          >
            {{ thread.label }}
          </button>
        }
      </div>

      <div class="p-2 border-t" style="border-color: var(--chat-border)">
        <button
          class="w-full rounded px-3 py-1.5 text-sm font-medium transition-colors"
          style="
            background: var(--chat-bg-hover);
            color: var(--chat-text);
          "
          (mouseenter)="$event.currentTarget.style.opacity = '0.8'"
          (mouseleave)="$event.currentTarget.style.opacity = '1'"
          (click)="newThread()"
        >
          + New Thread
        </button>
      </div>
    </aside>
  `,
})
export class PersistenceComponent {
  protected readonly threads = signal<Thread[]>([]);
  protected readonly activeThreadId = signal<string | null>(null);

  private threadCounter = 0;

  /**
   * The streaming resource with thread persistence.
   *
   * The `onThreadId` callback fires when a new thread is created,
   * allowing us to track thread IDs for the sidebar picker.
   */
  protected readonly stream = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
    onThreadId: (id: string) => {
      this.activeThreadId.set(id);

      // Only add if not already tracked
      const existing = this.threads();
      if (!existing.some((t) => t.id === id)) {
        this.threadCounter++;
        this.threads.set([
          ...existing,
          { id, label: `Thread ${this.threadCounter}` },
        ]);
      }
    },
  });

  /** Switch to an existing thread by ID. */
  switchThread(id: string): void {
    this.activeThreadId.set(id);
    this.stream.switchThread(id);
  }

  /** Start a brand-new thread. */
  newThread(): void {
    this.activeThreadId.set(null);
    this.stream.switchThread(null);
  }
}
