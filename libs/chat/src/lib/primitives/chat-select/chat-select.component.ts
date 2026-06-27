// libs/chat/src/lib/primitives/chat-select/chat-select.component.ts
// SPDX-License-Identifier: MIT
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  model,
  signal,
  viewChild,
  DOCUMENT,
} from '@angular/core';
import { OverlayModule } from '@angular/cdk/overlay';
import type { ConnectedPosition } from '@angular/cdk/overlay';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_SELECT_STYLES } from '../../styles/chat-select.styles';

export interface ChatSelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

/**
 * Generic single-select dropdown. Designed to slot into the chat input pill
 * (via [chatInputModelSelect]) but usable anywhere.
 *
 * The popover is rendered through a CDK connected overlay (a body-level portal)
 * rather than an absolutely-positioned child, so it is never clipped by an
 * ancestor's `overflow` and never trapped by an ancestor `transform` (e.g. a
 * sliding chat-sidebar panel). CDK's flexible position strategy flips and
 * shifts the menu to keep it inside the viewport.
 *
 * Inputs:
 *   options      — array of { value, label, disabled? }; required
 *   value        — currently selected value (two-way via model())
 *   placeholder  — trigger label when no option matches; default 'Select'
 *   disabled     — disables the trigger; default false
 *   menuLabel    — aria-label for the popover; defaults to placeholder
 *   panelClass   — extra class(es) on the overlay panel, for consumer styling
 *                  (the menu is portaled to the body, so `::ng-deep chat-select
 *                  .chat-select__menu` no longer reaches it — target the panel
 *                  class instead).
 */
@Component({
  selector: 'chat-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OverlayModule],
  styles: [CHAT_HOST_TOKENS, CHAT_SELECT_STYLES],
  template: `
    <button
      type="button"
      class="chat-select__trigger"
      cdkOverlayOrigin
      #origin="cdkOverlayOrigin"
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
    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="origin"
      [cdkConnectedOverlayOpen]="open()"
      [cdkConnectedOverlayPositions]="overlayPositions"
      [cdkConnectedOverlayPanelClass]="panelClasses()"
      [cdkConnectedOverlayPush]="true"
      [cdkConnectedOverlayViewportMargin]="8"
      [cdkConnectedOverlayFlexibleDimensions]="true"
      (overlayOutsideClick)="open.set(false)"
      (detach)="open.set(false)"
    >
      <div
        #menuEl
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
            <span class="chat-select__option-label">{{ opt.label }}</span>
            @if (opt.description) {
              <span class="chat-select__option-desc">{{ opt.description }}</span>
            }
          </button>
        }
      </div>
    </ng-template>
  `,
})
export class ChatSelectComponent {
  readonly options = input.required<readonly ChatSelectOption[]>();
  readonly value = model<string>('');
  readonly placeholder = input<string>('Select');
  readonly disabled = input<boolean>(false);
  readonly menuLabel = input<string | undefined>(undefined);
  readonly panelClass = input<string | string[]>('');

  protected readonly open = signal(false);

  // Preferred order: above the trigger right-aligned (the input pill sits at the
  // bottom of the screen, so "up" is the natural direction), then below, then
  // the left-aligned variants. CDK picks the first that fits and `push` nudges
  // it fully into the viewport.
  protected readonly overlayPositions: ConnectedPosition[] = [
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -8 },
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 8 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -8 },
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 8 },
  ];

  protected readonly panelClasses = computed<string[]>(() => {
    const extra = this.panelClass();
    const list = Array.isArray(extra) ? extra : extra ? [extra] : [];
    return ['chat-select__overlay', ...list];
  });

  protected readonly currentLabel = computed(() => {
    const v = this.value();
    const match = this.options().find((o) => o.value === v);
    return match?.label ?? this.placeholder();
  });

  private readonly hostEl = inject(ElementRef).nativeElement as HTMLElement;
  private readonly document = inject(DOCUMENT);
  // The menu is portaled out of the host into the overlay container, so option
  // lookups must go through this view ref rather than hostEl.querySelectorAll.
  private readonly menuEl = viewChild<ElementRef<HTMLElement>>('menuEl');

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
    const root = this.menuEl()?.nativeElement;
    return root ? Array.from(root.querySelectorAll<HTMLButtonElement>('.chat-select__option')) : [];
  }

  private queryTrigger(): HTMLButtonElement | null {
    return this.hostEl.querySelector<HTMLButtonElement>('.chat-select__trigger');
  }
}
