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
      <div class="chat-input__pill">
        <ng-content select="[chatInputLeading]" />
        <textarea
          #textareaEl
          class="chat-input__textarea"
          [ngModel]="messageText()"
          (ngModelChange)="messageText.set($event)"
          name="messageText"
          [placeholder]="placeholder()"
          (keydown.enter)="onKeydown($any($event))"
          (compositionstart)="composing.set(true)"
          (compositionend)="composing.set(false)"
          (focus)="focused.set(true)"
          (blur)="focused.set(false)"
          rows="1"
          aria-label="Type a message"
        ></textarea>
        <div class="chat-input__controls">
          <ng-content select="[chatInputModelSelect]" />
          <ng-content select="[chatInputTrailing]" />
          @if (isLoading() && canStop()) {
            <button
              type="button"
              class="chat-input__send chat-input__send--stop"
              (click)="onStop()"
              aria-label="Stop generating"
              title="Stop generating"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="6" y="6" width="12" height="12" rx="2"/>
              </svg>
            </button>
          } @else {
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
          }
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
  /** When true (default), shows a stop button while the agent is streaming. */
  readonly showStopButton = input<boolean>(true);
  readonly submitted = output<string>();
  readonly stopped = output<void>();
  readonly messageText = signal<string>('');
  readonly isLoading = computed(() => this.agent().isLoading());
  /** True while an IME composition (CJK input, accent, autocorrect) is active. */
  protected readonly composing = signal(false);
  readonly focused = signal(false);

  /** Submit is allowed only when not loading and there's non-whitespace text. */
  readonly canSubmit = computed(() => {
    if (this.isLoading()) return false;
    return this.messageText().trim().length > 0;
  });

  /** The stop button only appears when the consumer opted in AND we're loading. */
  readonly canStop = computed(() => this.showStopButton());

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

  /** Abort the current streaming response (if the adapter supports it). */
  onStop(): void {
    const a = this.agent() as unknown as { stop?: () => void | Promise<void> };
    if (typeof a.stop === 'function') {
      void a.stop();
    }
    this.stopped.emit();
  }

  onKeydown(event: KeyboardEvent): void {
    if (!this.submitOnEnter() || event.shiftKey) return;
    // Don't submit while an IME composition is in progress (CJK input,
    // dead-key accents, autocorrect popups). The composition's terminating
    // Enter must reach the textarea so the candidate is committed; submitting
    // here would discard the user's in-progress character.
    if (this.composing() || event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    this.onSubmit();
  }
}
