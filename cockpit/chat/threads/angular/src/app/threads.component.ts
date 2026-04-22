// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, signal } from '@angular/core';
import { ChatComponent, ChatThreadListComponent, type Thread } from '@cacheplane/chat';
import { agent, toChatAgent } from '@cacheplane/langgraph';
import { ExampleChatLayoutComponent } from '@cacheplane/example-layouts';
import { environment } from '../environments/environment';

/**
 * ThreadsComponent demonstrates multi-thread conversation management
 * with ChatComponent and ChatThreadListComponent in a sidebar.
 */
@Component({
  selector: 'app-threads',
  standalone: true,
  imports: [ChatComponent, ChatThreadListComponent, ExampleChatLayoutComponent],
  template: `
    <example-chat-layout sidebarPosition="left" sidebarWidth="w-64">
      <chat main [agent]="chatAgent" [threads]="threads()" [activeThreadId]="activeThreadId()" (threadSelected)="onThreadSelected($event)" class="flex-1 min-w-0" />
      <div sidebar class="p-4 space-y-4"
           style="background: var(--chat-bg, #171717); color: var(--chat-text, #e0e0e0);">
        <h3 class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--chat-text-muted, #777);">Threads</h3>
        <chat-thread-list
          [threads]="threads()"
          [activeThreadId]="activeThreadId()"
          (threadSelected)="onThreadSelected($event)" />
      </div>
    </example-chat-layout>
  `,
})
export class ThreadsComponent {
  protected readonly stream = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });
  protected readonly chatAgent = toChatAgent(this.stream);

  protected readonly threads = signal<Thread[]>([
    { id: 'thread-1', title: 'First Conversation' },
    { id: 'thread-2', title: 'Second Conversation' },
    { id: 'thread-3', title: 'Third Conversation' },
  ]);

  protected readonly activeThreadId = signal('thread-1');

  protected onThreadSelected(threadId: string): void {
    this.activeThreadId.set(threadId);
  }
}
