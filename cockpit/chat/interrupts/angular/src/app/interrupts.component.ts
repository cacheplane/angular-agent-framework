// SPDX-License-Identifier: MIT
import { Component, computed } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { ChatComponent, ChatInterruptPanelComponent } from '@ngaf/chat';
import { ExampleChatLayoutComponent } from '@ngaf/example-layouts';
import { agent } from '@ngaf/langgraph';
import { environment } from '../environments/environment';

/**
 * InterruptsComponent demonstrates human-in-the-loop approval gates
 * using ChatComponent and ChatInterruptPanelComponent.
 *
 * Shows interrupt payload and action buttons in a sidebar panel.
 */
@Component({
  selector: 'app-interrupts',
  standalone: true,
  imports: [ChatComponent, ChatInterruptPanelComponent, JsonPipe, ExampleChatLayoutComponent],
  template: `
    <example-chat-layout sidebarWidth="w-80">
      <chat main [agent]="agent" class="flex-1 min-w-0" />
      <div sidebar class="p-4 space-y-4" style="background: var(--chat-bg, #171717); color: var(--chat-text, #e0e0e0);">
        <h3 class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--chat-text-muted, #777);">Interrupt Panel</h3>
        <chat-interrupt-panel [agent]="agent" />
        <div class="mt-4">
          <h4 class="text-xs font-semibold uppercase tracking-wide mb-2"
              style="color: var(--chat-text-muted, #777);">Stream Status</h4>
          <p class="text-xs font-mono" style="color: var(--chat-text-muted, #777);">{{ streamStatus() }}</p>
        </div>
      </div>
    </example-chat-layout>
  `,
})
export class InterruptsComponent {
  protected readonly agent = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  protected readonly streamStatus = computed(() => this.agent.status());
}
