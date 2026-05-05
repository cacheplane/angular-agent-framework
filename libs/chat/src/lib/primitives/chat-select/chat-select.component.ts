// libs/chat/src/lib/primitives/chat-select/chat-select.component.ts
// SPDX-License-Identifier: MIT
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  DOCUMENT,
} from '@angular/core';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_SELECT_STYLES } from '../../styles/chat-select.styles';

export interface ChatSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * Generic single-select dropdown. Designed to slot into the chat input pill
 * (via [chatInputModelSelect]) but usable anywhere.
 *
 * Inputs:
 *   options      — array of { value, label, disabled? }; required
 *   value        — currently selected value (two-way via model())
 *   placeholder  — trigger label when no option matches; default 'Select'
 *   disabled     — disables the trigger; default false
 *   menuLabel    — aria-label for the popover; defaults to placeholder
 */
@Component({
  selector: 'chat-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, CHAT_SELECT_STYLES],
  template: `
    <button
      type="button"
      class="chat-select__trigger"
      [class.is-open]="open()"
      [disabled]="disabled()"
      [attr.aria-haspopup]="'listbox'"
      [attr.aria-expanded]="open()"
      (click)="toggle()"
      (keydown)="onTriggerKeydown($event)"
    >
      <span class="chat-select__label">{{ currentLabel() }}</span>
      <svg class="chat-select__chevron" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M4 6l4 4 4-4" stroke="currentColor" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
    @if (open()) {
      <div
        class="chat-select__menu"
        role="listbox"
        tabindex="-1"
        [attr.aria-label]="menuLabel() ?? placeholder()"
        (keydown)="onMenuKeydown($event)"
      >
        @for (opt of options(); track opt.value) {
          <button
            type="button"
            class="chat-select__option"
            [class.is-active]="opt.value === value()"
            [disabled]="opt.disabled === true"
            role="option"
            [attr.aria-selected]="opt.value === value()"
            (click)="selectOption(opt)"
          >
            {{ opt.label }}
          </button>
        }
      </div>
    }
  `,
})
export class ChatSelectComponent {
  readonly options = input.required<readonly ChatSelectOption[]>();
  readonly value = model<string>('');
  readonly placeholder = input<string>('Select');
  readonly disabled = input<boolean>(false);
  readonly menuLabel = input<string | undefined>(undefined);

  protected readonly open = signal(false);

  protected readonly currentLabel = computed(() => {
    const v = this.value();
    const match = this.options().find((o) => o.value === v);
    return match?.label ?? this.placeholder();
  });

  private readonly hostEl = inject(ElementRef).nativeElement as HTMLElement;
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    let onDocClick: ((e: Event) => void) | null = null;
    effect(() => {
      const isOpen = this.open();
      const win = this.document.defaultView;
      if (!win) return;
      if (isOpen && !onDocClick) {
        onDocClick = (e) => {
          const path = (e as Event & { composedPath?: () => EventTarget[] }).composedPath?.() ?? [];
          if (!path.includes(this.hostEl as EventTarget)) {
            this.open.set(false);
          }
        };
        win.addEventListener('mousedown', onDocClick, true);
      } else if (!isOpen && onDocClick) {
        win.removeEventListener('mousedown', onDocClick, true);
        onDocClick = null;
      }
    });
    this.destroyRef.onDestroy(() => {
      if (onDocClick) {
        const win = this.document.defaultView;
        win?.removeEventListener('mousedown', onDocClick, true);
        onDocClick = null;
      }
    });
  }

  protected toggle(): void {
    if (this.disabled()) return;
    this.open.update((v) => !v);
  }

  protected selectOption(opt: ChatSelectOption): void {
    if (opt.disabled) return;
    this.value.set(opt.value);
    this.open.set(false);
  }

  protected onTriggerKeydown(e: KeyboardEvent): void {
    if (this.disabled()) return;
    // Escape closes an open menu when focus is still on the trigger
    // (e.g. user clicked to open, then pressed Escape without arrowing
    // into the menu). Caught by live browser smoke — without this, click
    // + Escape leaves the menu open until the user clicks outside.
    if (e.key === 'Escape' && this.open()) {
      e.preventDefault();
      this.open.set(false);
      return;
    }
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      this.open.set(true);
      requestAnimationFrame(() => this.focusOption(0));
    }
  }

  protected onMenuKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.open.set(false);
      this.focusTrigger();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.moveFocus(e.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      const t = e.target as HTMLElement;
      if (t.classList.contains('chat-select__option')) {
        e.preventDefault();
        (t as HTMLButtonElement).click();
      }
    }
  }

  private focusOption(index: number): void {
    const opts = this.queryOptions();
    opts[index]?.focus();
  }

  private focusTrigger(): void {
    this.queryTrigger()?.focus();
  }

  private moveFocus(dir: 1 | -1): void {
    const opts = this.queryOptions().filter((b) => !b.disabled);
    if (!opts.length) return;
    const active = this.document.activeElement as HTMLElement | null;
    const idx = active ? opts.indexOf(active as HTMLButtonElement) : -1;
    const next = (idx + dir + opts.length) % opts.length;
    opts[next]?.focus();
  }

  private queryOptions(): HTMLButtonElement[] {
    return Array.from(this.hostEl.querySelectorAll<HTMLButtonElement>('.chat-select__option'));
  }

  private queryTrigger(): HTMLButtonElement | null {
    return this.hostEl.querySelector<HTMLButtonElement>('.chat-select__trigger');
  }
}
