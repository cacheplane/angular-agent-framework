// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  computed,
  input,
  ChangeDetectionStrategy,
} from '@angular/core';
import type { StreamResourceRef } from '@cacheplane/stream-resource';

/**
 * Extracts a human-readable message from an error value.
 * Handles Error objects, strings, and unknown values.
 * Exported for unit testing without DOM rendering.
 */
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
      <div role="alert">{{ msg }}</div>
    }
  `,
})
export class ChatErrorComponent {
  readonly ref = input.required<StreamResourceRef<any, any>>();

  readonly errorMessage = computed(() => extractErrorMessage(this.ref().error()));
}
