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

export type Thread = { id: string; [key: string]: unknown };

@Component({
  selector: 'chat-thread-list',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (thread of threads(); track thread.id) {
      @if (templateRef()) {
        <ng-container
          [ngTemplateOutlet]="templateRef()!"
          [ngTemplateOutletContext]="{ $implicit: thread, isActive: thread.id === activeThreadId() }"
        />
      }
    }
  `,
})
export class ChatThreadListComponent {
  readonly threads = input.required<Thread[]>();
  readonly activeThreadId = input<string>('');

  readonly threadSelected = output<string>();

  readonly templateRef = contentChild(TemplateRef);

  selectThread(threadId: string): void {
    this.threadSelected.emit(threadId);
  }
}
