// SPDX-License-Identifier: MIT
import { Component } from '@angular/core';
import { ChatDebugComponent } from '@threadplane/chat/debug';
import { injectAgent } from '@threadplane/langgraph';
import { ExampleChatLayoutComponent } from '@threadplane/example-layouts';

/**
 * DebugComponent demonstrates the ChatDebugComponent which provides
 * a full debug panel with timeline, state inspector, and diff viewer.
 * Uses ChatDebugComponent instead of the standard ChatComponent.
 */
@Component({
  selector: 'app-debug',
  standalone: true,
  imports: [ChatDebugComponent, ExampleChatLayoutComponent],
  template: `
    <example-chat-layout>
      <chat-debug main [agent]="agent" />
    </example-chat-layout>
  `,
})
export class DebugPageComponent {
  protected readonly agent = injectAgent();
}
