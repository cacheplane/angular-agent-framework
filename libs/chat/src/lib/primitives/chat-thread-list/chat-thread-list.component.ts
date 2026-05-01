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

export type Thread = { id: string; [key: string]: unknown };

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
            >{{ threadLabel(thread) }}</button>
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
}
