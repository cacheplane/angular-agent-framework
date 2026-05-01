// libs/chat/src/lib/primitives/chat-error/chat-error.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import type { Agent } from '../../agent';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_ERROR_STYLES } from '../../styles/chat-error.styles';

export function extractErrorMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
}

@Component({
  selector: 'chat-error',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, CHAT_ERROR_STYLES],
  template: `
    @if (errorMessage(); as msg) {
      <div class="chat-error" role="alert">
        <svg class="chat-error__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span class="chat-error__msg">{{ msg }}</span>
      </div>
    }
  `,
})
export class ChatErrorComponent {
  readonly agent = input.required<Agent>();
  readonly errorMessage = computed(() => extractErrorMessage(this.agent().error()));
}
