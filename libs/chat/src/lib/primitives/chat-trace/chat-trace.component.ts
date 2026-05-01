// libs/chat/src/lib/primitives/chat-trace/chat-trace.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, signal, effect, computed } from '@angular/core';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_TRACE_STYLES } from '../../styles/chat-trace.styles';

export type TraceState = 'pending' | 'running' | 'done' | 'error';

@Component({
  selector: 'chat-trace',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, CHAT_TRACE_STYLES],
  host: {
    '[attr.data-state]': 'state()',
    '[attr.data-expanded]': 'expandedStr()',
  },
  template: `
    <button
      type="button"
      class="chat-trace__header"
      [attr.aria-expanded]="expanded()"
      (click)="toggle()"
    >
      <svg class="chat-trace__chevron" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M4 2l4 4-4 4"/>
      </svg>
      <span class="chat-trace__label">
        <ng-content select="[traceIcon]" />
        <ng-content select="[traceLabel]" />
      </span>
      <ng-content select="[traceMeta]" />
    </button>
    @if (expanded()) {
      <div class="chat-trace__content"><ng-content /></div>
    }
  `,
})
export class ChatTraceComponent {
  readonly state = input<TraceState>('pending');

  /** null = follow auto state-driven logic; non-null = manual override */
  private readonly _expandedOverride = signal<boolean | null>(null);

  readonly expanded = computed(() => {
    const override = this._expandedOverride();
    if (override !== null) return override;
    return this.state() === 'running';
  });

  readonly expandedStr = computed(() => String(this.expanded()));

  constructor() {
    let prevState: TraceState | undefined;
    effect(() => {
      const s = this.state();
      if (s === 'running') {
        this._expandedOverride.set(null);
      } else if (s === 'done' && prevState === 'running') {
        setTimeout(() => this._expandedOverride.set(false), 200);
      }
      prevState = s;
    });
  }

  toggle(): void {
    this._expandedOverride.set(!this.expanded());
  }
}
