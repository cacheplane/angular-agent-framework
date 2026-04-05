// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  computed,
  input,
  output,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HumanMessage } from '@langchain/core/messages';
import type { StreamResourceRef } from '@cacheplane/stream-resource';

/**
 * Submits a message to a StreamResourceRef.
 * Returns the trimmed text that was submitted, or null if the text was empty.
 * Exported for unit testing without DOM rendering.
 */
export function submitMessage(
  ref: StreamResourceRef<any, any>,
  text: string,
): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  ref.submit({ messages: [new HumanMessage(trimmed)] });
  return trimmed;
}

@Component({
  selector: 'chat-input',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form (submit)="onSubmit(); $event.preventDefault()">
      <textarea
        [(ngModel)]="messageText"
        name="messageText"
        [placeholder]="placeholder()"
        [disabled]="isDisabled()"
        (keydown.enter)="onKeydown($any($event))"
      ></textarea>
      <button type="submit" [disabled]="isDisabled()">Send</button>
    </form>
  `,
})
export class ChatInputComponent {
  readonly ref = input.required<StreamResourceRef<any, any>>();
  readonly submitOnEnter = input<boolean>(true);
  readonly placeholder = input<string>('');

  readonly submitted = output<string>();

  readonly messageText = signal<string>('');

  readonly isDisabled = computed(() => this.ref().isLoading());

  onSubmit(): void {
    const submitted = submitMessage(this.ref(), this.messageText());
    if (submitted !== null) {
      this.submitted.emit(submitted);
      this.messageText.set('');
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (this.submitOnEnter() && !event.shiftKey) {
      event.preventDefault();
      this.onSubmit();
    }
  }
}
