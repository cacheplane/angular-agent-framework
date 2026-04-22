// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  input,
  ChangeDetectionStrategy,
} from '@angular/core';
import { DebugStateDiffComponent } from './debug-state-diff.component';
import { DebugStateInspectorComponent } from './debug-state-inspector.component';

@Component({
  selector: 'chat-debug-detail',
  standalone: true,
  imports: [DebugStateDiffComponent, DebugStateInspectorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-3">
      <section>
        <h4 class="text-xs font-semibold text-[var(--chat-text-muted)] uppercase tracking-wide mb-1">State Diff</h4>
        <chat-debug-state-diff [before]="previousState()" [after]="currentState()" />
      </section>
      <section>
        <h4 class="text-xs font-semibold text-[var(--chat-text-muted)] uppercase tracking-wide mb-1">Current State</h4>
        <chat-debug-state-inspector [state]="currentState()" />
      </section>
    </div>
  `,
})
export class DebugDetailComponent {
  readonly currentState = input<Record<string, unknown>>({});
  readonly previousState = input<Record<string, unknown>>({});
}
