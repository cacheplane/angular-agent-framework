// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  input,
  ChangeDetectionStrategy,
} from '@angular/core';
import { JsonPipe } from '@angular/common';

@Component({
  selector: 'chat-debug-state-inspector',
  standalone: true,
  imports: [JsonPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="overflow-auto max-h-64">
      <pre class="text-xs font-mono text-gray-700 whitespace-pre-wrap break-all">{{ state() | json }}</pre>
    </div>
  `,
})
export class DebugStateInspectorComponent {
  readonly state = input<Record<string, unknown>>({});
}
