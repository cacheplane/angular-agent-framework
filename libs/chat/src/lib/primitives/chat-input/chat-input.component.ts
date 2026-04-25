// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
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
  styles: [`
    textarea {
      field-sizing: content;
    }
  `],
  template: `
    <form
      (submit)="onSubmit(); $event.preventDefault()"
      class="flex items-center gap-2 px-4 py-2.5 pl-[18px] border transition-colors duration-150"
      [style.background]="'var(--chat-input-bg)'"
      [style.borderColor]="focused() ? 'var(--chat-input-focus-border)' : 'var(--chat-input-border)'"
      [style.borderRadius]="'var(--chat-radius-input)'"
      role="search"
      aria-label="Message input"
    >
      <textarea
        [(ngModel)]="messageText"
        name="messageText"
        [placeholder]="placeholder()"
        [disabled]="isDisabled()"
        (keydown.enter)="onKeydown($any($event))"
        (focus)="focused.set(true)"
        (blur)="focused.set(false)"
        rows="1"
        #textareaEl
        class="flex-1 bg-transparent border-0 outline-none resize-none max-h-[120px] overflow-y-auto"
        [style.color]="'var(--chat-text)'"
        [style.fontFamily]="'var(--chat-font-family)'"
        style="font-size: 15px; line-height: 1.6;"
        aria-label="Type a message"
      ></textarea>
      <button
        type="submit"
        [disabled]="isDisabled()"
        class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-0 cursor-pointer transition-colors duration-150 disabled:opacity-50"
        [style.background]="'var(--chat-send-bg)'"
        [style.color]="'var(--chat-send-text)'"
        aria-label="Send message"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 12V4M8 4L4 8M8 4L12 8"/>
        </svg>
      </button>
    </form>
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

  private readonly textareaEl = viewChild<ElementRef<HTMLTextAreaElement>>('textareaEl');

  onSubmit(): void {
    const submitted = submitMessage(this.agent(), this.messageText());
    if (submitted !== null) {
      this.submitted.emit(submitted);
      this.messageText.set('');
      // Re-focus the textarea after submit
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
