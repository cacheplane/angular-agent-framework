// SPDX-License-Identifier: MIT
import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  TemplateRef,
  computed,
  contentChild,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { Agent } from '../../agent';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';

export type ChatApprovalAction = 'approve' | 'edit' | 'cancel';

@Component({
  selector: 'chat-approval-card',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    CHAT_HOST_TOKENS,
    `
    :host { display: contents; }
    dialog.chat-approval-card {
      width: 440px;
      max-width: calc(100vw - 32px);
      padding: 0;
      border: 0;
      border-radius: 12px;
      background: var(--ngaf-chat-surface);
      color: var(--ngaf-chat-text);
      box-shadow: 0 20px 50px rgba(0,0,0,0.18);
    }
    dialog.chat-approval-card::backdrop {
      background: rgba(0,0,0,0.32);
    }
    .chat-approval-card__header {
      padding: 14px 16px 12px;
      display: flex;
      align-items: center;
      gap: 8px;
      border-bottom: 1px solid var(--ngaf-chat-separator);
    }
    .chat-approval-card__header h4 {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      color: var(--ngaf-chat-text);
    }
    .chat-approval-card__header svg {
      color: var(--ngaf-chat-warning-text);
      width: 16px;
      height: 16px;
      flex: 0 0 16px;
    }
    .chat-approval-card__body {
      padding: 14px 16px;
      font-size: var(--ngaf-chat-font-size-sm, 13px);
      color: var(--ngaf-chat-text);
    }
    .chat-approval-card__actions {
      padding: 8px 16px 14px;
      display: flex;
      gap: 6px;
      justify-content: flex-end;
      align-items: center;
    }
    .btn {
      border: 0;
      padding: 6px 14px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: transform 200ms ease, opacity 200ms ease;
    }
    .btn:hover { transform: scale(1.03); }
    .btn-primary { background: var(--ngaf-chat-primary); color: var(--ngaf-chat-on-primary); }
    .btn-secondary { background: transparent; color: var(--ngaf-chat-text); border: 1px solid var(--ngaf-chat-separator); }
    .btn-text {
      background: transparent;
      color: var(--ngaf-chat-text-muted);
      padding: 6px 10px;
    }
    .btn-text:hover { color: var(--ngaf-chat-text); }
    `,
  ],
  template: `
    <dialog #dialogEl class="chat-approval-card" (close)="onDialogClose()" (cancel)="onCancelEvent($event)">
      <div class="chat-approval-card__header">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <h4>{{ title() }}</h4>
      </div>
      <div class="chat-approval-card__body">
        @if (bodyTemplate(); as tpl) {
          @if (payload(); as p) {
            <ng-container *ngTemplateOutlet="tpl; context: { $implicit: p }"></ng-container>
          }
        }
      </div>
      <div class="chat-approval-card__actions">
        <button type="button" class="btn btn-text" (click)="emit('cancel')">Cancel</button>
        @if (showEdit()) {
          <button type="button" class="btn btn-secondary" (click)="emit('edit')">Edit</button>
        }
        <button type="button" class="btn btn-primary" (click)="emit('approve')">Approve</button>
      </div>
    </dialog>
  `,
})
export class ChatApprovalCardComponent {
  readonly agent = input.required<Agent>();
  readonly matchKind = input<string | undefined>(undefined);
  readonly title = input<string>('Approval required');
  readonly showEdit = input<boolean>(false);

  readonly action = output<ChatApprovalAction>();

  protected readonly bodyTemplate = contentChild<TemplateRef<unknown>>('body');
  private readonly dialogRef = viewChild<ElementRef<HTMLDialogElement>>('dialogEl');

  private readonly interrupt = computed(() => this.agent().interrupt?.());

  protected readonly payload = computed(() => {
    const i = this.interrupt();
    if (!i) return undefined;
    const v = i.value as { kind?: unknown } | undefined;
    const want = this.matchKind();
    if (want !== undefined) {
      if (!v || typeof v !== 'object' || (v as { kind?: unknown }).kind !== want) {
        return undefined;
      }
    }
    return v;
  });

  constructor() {
    effect(() => {
      const p = this.payload();
      const dialog = this.dialogRef()?.nativeElement;
      if (!dialog) return;
      // jsdom (test env) doesn't implement HTMLDialogElement methods; guard.
      const showModal = (dialog as { showModal?: () => void }).showModal;
      const close = (dialog as { close?: () => void }).close;
      if (p && !dialog.open) {
        if (typeof showModal === 'function') showModal.call(dialog);
      } else if (!p && dialog.open) {
        if (typeof close === 'function') close.call(dialog);
      }
    });
  }

  protected emit(action: ChatApprovalAction): void {
    this.action.emit(action);
    this.closeDialog();
  }

  protected onCancelEvent(ev: Event): void {
    // Native dialog's cancel event fires on Escape. Treat as cancel.
    ev.preventDefault();
    this.action.emit('cancel');
    this.closeDialog();
  }

  private closeDialog(): void {
    const dialog = this.dialogRef()?.nativeElement;
    if (!dialog) return;
    const close = (dialog as { close?: () => void }).close;
    if (typeof close === 'function') close.call(dialog);
  }

  protected onDialogClose(): void {
    // Native close — no-op; emit happens in emit() / onCancelEvent.
  }
}
