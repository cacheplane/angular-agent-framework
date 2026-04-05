// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  computed,
  input,
  ChangeDetectionStrategy,
} from '@angular/core';
import type { StreamResourceRef } from '@cacheplane/stream-resource';

/**
 * Returns whether the typing indicator should be visible.
 * Exported for unit testing without DOM rendering.
 */
export function isTyping(ref: StreamResourceRef<any, any>): boolean {
  return ref.isLoading();
}

@Component({
  selector: 'chat-typing-indicator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div role="status" aria-label="Agent is typing">
        <span class="chat-typing-indicator">...</span>
      </div>
    }
  `,
})
export class ChatTypingIndicatorComponent {
  readonly ref = input.required<StreamResourceRef<any, any>>();

  readonly visible = computed(() => this.ref().isLoading());
}
