// SPDX-License-Identifier: MIT
import {
  Component,
  computed,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import type { Agent } from '../../agent';
import type { AgentInterrupt } from '../../agent/agent-interrupt';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';

export type InterruptAction = 'accept' | 'edit' | 'respond' | 'ignore';

/**
 * Retrieves the current interrupt value from an Agent, or undefined when
 * the runtime does not expose interrupts.
 * Exported for unit testing without DOM rendering.
 */
export function getInterruptFromAgent(agent: Agent): AgentInterrupt | undefined {
  return agent.interrupt?.();
}

/**
 * Extracts a human-readable reason from an interrupt value. When the value
 * is an object with a string `reason` field, returns that directly. Falls
 * back to a JSON dump so consumers always see something rather than nothing.
 * Exported for unit testing.
 */
export function interruptReasonText(interrupt: AgentInterrupt | undefined): string {
  if (!interrupt) return '';
  const v = interrupt.value as { reason?: unknown } | undefined;
  if (v && typeof v === 'object' && typeof (v as { reason?: unknown }).reason === 'string') {
    return (v as { reason: string }).reason;
  }
  if (typeof v === 'string') return v;
  return JSON.stringify(v ?? '', null, 2);
}

@Component({
  selector: 'chat-interrupt-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    CHAT_HOST_TOKENS,
    `
    .chat-interrupt-panel {
      background: var(--ngaf-chat-surface);
      color: var(--ngaf-chat-text);
      border: 1px solid var(--ngaf-chat-separator);
      border-left: 3px solid var(--ngaf-chat-warning-text);
      border-radius: var(--ngaf-chat-radius-card);
      padding: 12px 16px;
      font-size: var(--ngaf-chat-font-size-sm);
    }
    .chat-interrupt-panel__title {
      font-weight: 600;
      margin: 0 0 4px;
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--ngaf-chat-text);
    }
    .chat-interrupt-panel__title svg {
      color: var(--ngaf-chat-warning-text);
    }
    .chat-interrupt-panel__body {
      margin: 0 0 12px;
      color: var(--ngaf-chat-text-muted);
      white-space: pre-wrap;
    }
    .chat-interrupt-panel__actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
    }
    .chat-interrupt-panel__btn {
      padding: 6px 14px;
      font-size: var(--ngaf-chat-font-size-sm);
      border-radius: var(--ngaf-chat-radius-button);
      border: 0;
      cursor: pointer;
      font-weight: 500;
      transition: transform 200ms ease, opacity 200ms ease;
    }
    .chat-interrupt-panel__btn:hover { transform: scale(1.03); }
    .chat-interrupt-panel__btn--primary {
      background: var(--ngaf-chat-primary);
      color: var(--ngaf-chat-on-primary);
    }
    .chat-interrupt-panel__btn--secondary {
      background: transparent;
      color: var(--ngaf-chat-text);
      border: 1px solid var(--ngaf-chat-separator);
    }
    .chat-interrupt-panel__btn--tertiary {
      background: transparent;
      color: var(--ngaf-chat-text-muted);
      padding: 6px 8px;
      font-size: var(--ngaf-chat-font-size-sm);
    }
    .chat-interrupt-panel__btn--tertiary:hover {
      color: var(--ngaf-chat-text);
    }
    `,
  ],
  template: `
    @if (interrupt()) {
      <div role="alert" class="chat-interrupt-panel">
        <p class="chat-interrupt-panel__title">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          Agent paused
        </p>
        <p class="chat-interrupt-panel__body">{{ interruptReason() }}</p>

        <div class="chat-interrupt-panel__actions">
          <button
            type="button"
            class="chat-interrupt-panel__btn chat-interrupt-panel__btn--primary"
            (click)="action.emit('accept')"
          >Accept</button>
          <button
            type="button"
            class="chat-interrupt-panel__btn chat-interrupt-panel__btn--secondary"
            (click)="action.emit('edit')"
          >Edit</button>
          <button
            type="button"
            class="chat-interrupt-panel__btn chat-interrupt-panel__btn--secondary"
            (click)="action.emit('respond')"
          >Respond</button>
          <button
            type="button"
            class="chat-interrupt-panel__btn chat-interrupt-panel__btn--tertiary"
            (click)="action.emit('ignore')"
          >Ignore</button>
        </div>
      </div>
    }
  `,
})
export class ChatInterruptPanelComponent {
  readonly agent = input.required<Agent>();

  readonly action = output<InterruptAction>();

  readonly interrupt = computed(() => getInterruptFromAgent(this.agent()));

  readonly interruptReason = computed(() => interruptReasonText(this.interrupt()));
}
