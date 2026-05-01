// SPDX-License-Identifier: MIT
import {
  Component,
  input,
  ChangeDetectionStrategy,
} from '@angular/core';
import { DebugStateDiffComponent } from './debug-state-diff.component';
import { DebugStateInspectorComponent } from './debug-state-inspector.component';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';

@Component({
  selector: 'chat-debug-detail',
  standalone: true,
  imports: [DebugStateDiffComponent, DebugStateInspectorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    CHAT_HOST_TOKENS,
    `
    .debug-detail {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .debug-detail__section-title {
      font-size: var(--ngaf-chat-font-size-xs);
      font-weight: 600;
      color: var(--ngaf-chat-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin: 0 0 4px;
    }
    `,
  ],
  template: `
    <div class="debug-detail">
      <section>
        <h4 class="debug-detail__section-title">State Diff</h4>
        <chat-debug-state-diff [before]="previousState()" [after]="currentState()" />
      </section>
      <section>
        <h4 class="debug-detail__section-title">Current State</h4>
        <chat-debug-state-inspector [state]="currentState()" />
      </section>
    </div>
  `,
})
export class DebugDetailComponent {
  readonly currentState = input<Record<string, unknown>>({});
  readonly previousState = input<Record<string, unknown>>({});
}
