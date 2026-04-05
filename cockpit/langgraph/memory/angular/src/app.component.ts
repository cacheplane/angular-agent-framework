import { Component, inject, Injector, OnInit, signal } from '@angular/core';
import { runInInjectionContext } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatComponent } from '@cacheplane/chat';
import { streamResource, StreamResourceRef } from '@cacheplane/stream-resource';

interface Thread {
  id: string;
  label: string;
}

@Component({
  selector: 'app-memory',
  standalone: true,
  imports: [CommonModule, ChatComponent],
  template: `
    <div class="h-screen flex bg-gray-950 text-gray-100">
      <!-- Thread list — memory persists across all threads for this userId -->
      <aside class="w-64 flex flex-col border-r border-gray-800 bg-gray-900">
        <div class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Sessions
        </div>
        <ul class="flex-1 overflow-y-auto">
          @for (thread of threads(); track thread.id) {
            <li>
              <button
                class="w-full text-left px-4 py-2 text-sm hover:bg-gray-800 transition-colors"
                [class.bg-gray-800]="activeThreadId() === thread.id"
                (click)="selectThread(thread.id)"
              >
                {{ thread.label }}
              </button>
            </li>
          }
        </ul>
        <button
          class="m-3 rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
          (click)="newThread()"
        >
          + New session
        </button>
      </aside>

      <!-- Chat — the agent recalls cross-thread memories automatically -->
      <div class="flex flex-col flex-1 overflow-hidden">
        <chat [ref]="chat" class="flex-1" />
      </div>
    </div>
  `,
})
export class MemoryAppComponent implements OnInit {
  private readonly injector = inject(Injector);
  /** Stable user identity so the memory store scopes memories correctly. */
  private readonly userId = 'demo-user';

  chat!: StreamResourceRef<any>;
  threads = signal<Thread[]>([
    { id: 'thread-1', label: 'Session 1' },
    { id: 'thread-2', label: 'Session 2' },
  ]);
  activeThreadId = signal<string>('thread-1');

  ngOnInit(): void {
    this.initChat(this.activeThreadId());
  }

  selectThread(threadId: string): void {
    this.activeThreadId.set(threadId);
    this.initChat(threadId);
  }

  newThread(): void {
    const id = `thread-${Date.now()}`;
    this.threads.update((ts) => [
      ...ts,
      { id, label: `Session ${ts.length + 1}` },
    ]);
    this.selectThread(id);
  }

  private initChat(threadId: string): void {
    runInInjectionContext(this.injector, () => {
      this.chat = streamResource({
        assistantId: 'memory_agent',
        threadId,
        metadata: { userId: this.userId },
      });
    });
  }
}
