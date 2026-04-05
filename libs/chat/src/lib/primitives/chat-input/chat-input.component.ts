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
    <form
      (submit)="onSubmit(); $event.preventDefault()"
      style="
        display: flex;
        align-items: flex-end;
        gap: 8px;
        background: var(--chat-input-bg, #222222);
        border: 1px solid {{ focused ? 'var(--chat-input-focus-border, #555555)' : 'var(--chat-input-border, #333333)' }};
        border-radius: var(--chat-radius-input, 24px);
        padding: 10px 14px 10px 18px;
        transition: border-color 0.15s;
      "
      [style.borderColor]="focused ? 'var(--chat-input-focus-border, #555555)' : 'var(--chat-input-border, #333333)'"
    >
      <textarea
        [(ngModel)]="messageText"
        name="messageText"
        [placeholder]="placeholder()"
        [disabled]="isDisabled()"
        (keydown.enter)="onKeydown($any($event))"
        (focus)="focused = true"
        (blur)="focused = false"
        rows="1"
        style="
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          resize: none;
          color: var(--chat-text, #e0e0e0);
          font-family: var(--chat-font-family, -apple-system, BlinkMacSystemFont, system-ui, sans-serif);
          font-size: 15px;
          line-height: 1.6;
          max-height: 120px;
          overflow-y: auto;
        "
      ></textarea>
      <button
        type="submit"
        [disabled]="isDisabled()"
        style="
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--chat-send-bg, #444444);
          color: var(--chat-send-text, #aaaaaa);
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: background 0.15s;
        "
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 12V4M8 4L4 8M8 4L12 8"/>
        </svg>
      </button>
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

  focused = false;

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
