// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  computed,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import type { StreamResourceRef } from '@cacheplane/stream-resource';

export type InterruptAction = 'accept' | 'edit' | 'respond' | 'ignore';

@Component({
  selector: 'chat-interrupt-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (interrupt()) {
      <div class="rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-3">
        <!-- Warning header -->
        <div class="flex items-start gap-2">
          <span class="text-amber-600 text-lg">⚠</span>
          <div class="flex-1">
            <h3 class="text-sm font-semibold text-amber-800">Agent Interrupt</h3>
            <p class="text-sm text-amber-700 mt-1">{{ interruptPayload() }}</p>
          </div>
        </div>

        <!-- Action buttons -->
        <div class="flex flex-wrap gap-2">
          <button
            class="px-3 py-1.5 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors"
            (click)="action.emit('accept')"
          >
            Accept
          </button>
          <button
            class="px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            (click)="action.emit('edit')"
          >
            Edit
          </button>
          <button
            class="px-3 py-1.5 text-sm font-medium rounded-md bg-purple-600 text-white hover:bg-purple-700 transition-colors"
            (click)="action.emit('respond')"
          >
            Respond
          </button>
          <button
            class="px-3 py-1.5 text-sm font-medium rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
            (click)="action.emit('ignore')"
          >
            Ignore
          </button>
        </div>
      </div>
    }
  `,
})
export class ChatInterruptPanelComponent {
  readonly ref = input.required<StreamResourceRef<any, any>>();

  readonly action = output<InterruptAction>();

  readonly interrupt = computed(() => this.ref().interrupt());

  readonly interruptPayload = computed(() => {
    const interrupt = this.interrupt();
    if (!interrupt) return '';
    const val = interrupt.value;
    if (typeof val === 'string') return val;
    return JSON.stringify(val);
  });
}
