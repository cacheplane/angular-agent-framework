// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  computed,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import type { StreamResourceRef } from '@cacheplane/stream-resource';
import { ICON_WARNING } from '../../styles/chat-icons';

export type InterruptAction = 'accept' | 'edit' | 'respond' | 'ignore';

@Component({
  selector: 'chat-interrupt-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (interrupt()) {
      <div
        role="alert"
        class="flex flex-col gap-3 p-4 border"
        style="background: var(--chat-warning-bg); border-color: var(--chat-border); border-radius: var(--chat-radius-card);"
      >
        <!-- Warning header -->
        <div class="flex items-start gap-2">
          <span style="color: var(--chat-warning-text);" [innerHTML]="warningIcon"></span>
          <div class="flex-1">
            <h3 class="text-sm font-semibold m-0" style="color: var(--chat-warning-text);">Agent Interrupt</h3>
            <p class="text-sm mt-1 mb-0" style="color: var(--chat-warning-text);">{{ interruptPayload() }}</p>
          </div>
        </div>

        <!-- Action buttons -->
        <div class="flex flex-wrap gap-2">
          <button
            class="px-3 py-1.5 text-sm font-medium border cursor-pointer"
            [style.background]="'var(--chat-bg-alt)'"
            [style.color]="'var(--chat-text)'"
            [style.border-color]="'var(--chat-border)'"
            [style.border-radius]="'var(--chat-radius-card)'"
            (click)="action.emit('accept')"
          >
            Accept
          </button>
          <button
            class="px-3 py-1.5 text-sm font-medium border cursor-pointer"
            [style.background]="'var(--chat-bg-alt)'"
            [style.color]="'var(--chat-text)'"
            [style.border-color]="'var(--chat-border)'"
            [style.border-radius]="'var(--chat-radius-card)'"
            (click)="action.emit('edit')"
          >
            Edit
          </button>
          <button
            class="px-3 py-1.5 text-sm font-medium border cursor-pointer"
            [style.background]="'var(--chat-bg-alt)'"
            [style.color]="'var(--chat-text)'"
            [style.border-color]="'var(--chat-border)'"
            [style.border-radius]="'var(--chat-radius-card)'"
            (click)="action.emit('respond')"
          >
            Respond
          </button>
          <button
            class="px-3 py-1.5 text-sm font-medium bg-transparent border-0 cursor-pointer"
            [style.color]="'var(--chat-text-muted)'"
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

  readonly warningIcon = ICON_WARNING;

  readonly interrupt = computed(() => this.ref().interrupt());

  readonly interruptPayload = computed(() => {
    const interrupt = this.interrupt();
    if (!interrupt) return '';
    const val = interrupt.value;
    if (typeof val === 'string') return val;
    return JSON.stringify(val);
  });
}
