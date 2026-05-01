// libs/chat/src/lib/primitives/chat-input/chat-input.component.ts
// SPDX-License-Identifier: MIT
import {
  Component,
  computed,
  input,
  output,
  signal,
  viewChild,
  ElementRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Agent } from '../../agent';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_INPUT_STYLES } from '../../styles/chat-input.styles';

/**
 * Submits a trimmed message to the agent.
 * Returns the trimmed string on success, or `null` if the input was empty.
 */
export function submitMessage(
  agent: Agent,
  text: string,
): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  void agent.submit({ message: trimmed });
  return trimmed;
}

@Component({
  selector: 'chat-input',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, CHAT_INPUT_STYLES],
  template: `
    <div class="chat-input__container">
      <ng-content select="[chatInputBanner]" />
      <ng-content select="[chatInputAttachments]" />
      <div class="chat-input__pill" (click)="focusTextarea()">
        <ng-content select="[chatInputLeading]" />
        <textarea
          #textareaEl
          class="chat-input__textarea"
          [(ngModel)]="messageTextProxy"
          name="messageText"
          [placeholder]="placeholder()"
          [disabled]="isDisabled()"
          (keydown.enter)="onKeydown($any($event))"
          (focus)="focused.set(true)"
          (blur)="focused.set(false)"
          rows="1"
          aria-label="Type a message"
        ></textarea>
        <div class="chat-input__controls">
          <ng-content select="[chatInputTrailing]" />
          <button
            type="button"
            class="chat-input__send"
            [disabled]="!canSubmit()"
            (click)="onSubmit()"
            aria-label="Send message"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="12" y1="19" x2="12" y2="5"/>
              <polyline points="5 12 12 5 19 12"/>
            </svg>
          </button>
        </div>
      </div>
      <ng-content select="[chatInputFooter]" />
    </div>
  `,
})
export class ChatInputComponent {
  readonly agent = input.required<Agent>();
  readonly submitOnEnter = input<boolean>(true);
  readonly placeholder = input<string>('');
  readonly submitted = output<string>();
  readonly messageText = signal<string>('');
  readonly isDisabled = computed(() => this.agent().isLoading());
  readonly focused = signal(false);

  /** Two-way binding helper for ngModel */
  get messageTextProxy(): string { return this.messageText(); }
  set messageTextProxy(v: string) { this.messageText.set(v); }

  readonly canSubmit = computed(() => {
    if (this.isDisabled()) return false;
    return this.messageText().trim().length > 0;
  });

  private readonly textareaEl = viewChild<ElementRef<HTMLTextAreaElement>>('textareaEl');

  focusTextarea(): void {
    this.textareaEl()?.nativeElement.focus();
  }

  onSubmit(): void {
    const submitted = submitMessage(this.agent(), this.messageText());
    if (submitted !== null) {
      this.submitted.emit(submitted);
      this.messageText.set('');
      requestAnimationFrame(() => this.textareaEl()?.nativeElement.focus());
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (this.submitOnEnter() && !event.shiftKey) {
      event.preventDefault();
      this.onSubmit();
    }
  }
}
