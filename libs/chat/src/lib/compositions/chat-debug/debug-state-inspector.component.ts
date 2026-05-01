// SPDX-License-Identifier: MIT
import {
  Component,
  input,
  ChangeDetectionStrategy,
} from '@angular/core';
import { JsonPipe } from '@angular/common';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';

@Component({
  selector: 'chat-debug-state-inspector',
  standalone: true,
  imports: [JsonPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    CHAT_HOST_TOKENS,
    `
    .debug-state-inspector {
      overflow: auto;
      max-height: 256px;
    }
    .debug-state-inspector__pre {
      font-size: var(--ngaf-chat-font-size-xs);
      font-family: var(--ngaf-chat-font-mono);
      color: var(--ngaf-chat-text);
      white-space: pre-wrap;
      word-break: break-all;
      margin: 0;
    }
    `,
  ],
  template: `
    <div class="debug-state-inspector">
      <pre class="debug-state-inspector__pre">{{ state() | json }}</pre>
    </div>
  `,
})
export class DebugStateInspectorComponent {
  readonly state = input<Record<string, unknown>>({});
}
