// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  computed,
  input,
  ChangeDetectionStrategy,
} from '@angular/core';
import type { StreamResourceRef } from '@cacheplane/stream-resource';

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
  template: `
    @if (errorMessage(); as msg) {
      <div
        class="px-4 py-3 text-sm"
        style="background: var(--chat-error-bg); color: var(--chat-error-text); border-radius: var(--chat-radius-card);"
        role="alert"
      >{{ msg }}</div>
    }
  `,
})
export class ChatErrorComponent {
  readonly ref = input.required<StreamResourceRef<any, any>>();
  readonly errorMessage = computed(() => extractErrorMessage(this.ref().error()));
}
