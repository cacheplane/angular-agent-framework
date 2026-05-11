// libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.ts
// SPDX-License-Identifier: MIT
import {
  Component,
  contentChild,
  input,
  output,
  TemplateRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_THREAD_LIST_STYLES } from '../../styles/chat-thread-list.styles';

export type Thread = {
  id: string;
  /** Optional human-friendly label. Falls back to a slice of the id. */
  title?: string;
  /** Optional epoch-ms timestamp used by the default item template to
   *  render a relative-time line ("just now" / "5 min ago"). When absent
   *  the default template omits the second line. */
  updatedAt?: number;
  [key: string]: unknown;
};

@Component({
  selector: 'chat-thread-list',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, CHAT_THREAD_LIST_STYLES],
  template: `
    @if (showNewThreadButton()) {
      <button type="button" class="chat-thread-list__new" (click)="newThreadRequested.emit()">+ New thread</button>
    }
    <ul class="chat-thread-list">
      @for (thread of threads(); track thread.id) {
        <li>
          @if (templateRef()) {
            <ng-container
              [ngTemplateOutlet]="templateRef()!"
              [ngTemplateOutletContext]="{ $implicit: thread, isActive: thread.id === activeThreadId() }"
            />
          } @else {
            <button
              type="button"
              class="chat-thread-list__item"
              [attr.data-active]="thread.id === activeThreadId() ? 'true' : null"
              [attr.aria-current]="thread.id === activeThreadId() ? 'true' : null"
              (click)="selectThread(thread.id)"
            >
              <span class="chat-thread-list__item-title">{{ threadLabel(thread) }}</span>
              @if (thread.updatedAt !== undefined) {
                <span class="chat-thread-list__item-time">{{ relativeTime(thread.updatedAt) }}</span>
              }
            </button>
          }
        </li>
      }
    </ul>
  `,
})
export class ChatThreadListComponent {
  readonly threads = input.required<Thread[]>();
  readonly activeThreadId = input<string>('');
  readonly showNewThreadButton = input<boolean>(false);

  readonly threadSelected = output<string>();
  readonly newThreadRequested = output<void>();

  readonly templateRef = contentChild(TemplateRef);

  selectThread(threadId: string): void {
    this.threadSelected.emit(threadId);
  }

  protected threadLabel(thread: Thread): string {
    const title = thread['title'];
    if (typeof title === 'string' && title.length > 0) return title;
    return thread.id;
  }

  protected relativeTime(epochMs: number): string {
    const delta = Date.now() - epochMs;
    if (delta < 60_000) return 'just now';
    if (delta < 3_600_000) return `${Math.floor(delta / 60_000)} min ago`;
    if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)} hr ago`;
    return `${Math.floor(delta / 86_400_000)} day ago`;
  }
}
