// SPDX-License-Identifier: MIT
import { Component, computed } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { ChatComponent, ChatInterruptPanelComponent } from '@ngaf/chat';
import type { InterruptAction } from '@ngaf/chat';
import { ExampleChatLayoutComponent } from '@ngaf/example-layouts';
import { agent } from '@ngaf/langgraph';
import { environment } from '../environments/environment';

/**
 * InterruptsComponent demonstrates human-in-the-loop approval gates
 * using ChatComponent and ChatInterruptPanelComponent.
 *
 * Shows interrupt payload and action buttons in a sidebar panel.
 * Maps the panel's UI actions to LangGraph resume payloads:
 *   Accept  → resume('confirm')   — the book_flight tool returns Booked …
 *   Ignore  → resume('cancel')    — the book_flight tool returns Booking cancelled.
 * Edit / Respond are not wired for this demo's single-decision booking flow.
 */
@Component({
  selector: 'app-interrupts',
  standalone: true,
  imports: [ChatComponent, ChatInterruptPanelComponent, JsonPipe, ExampleChatLayoutComponent],
  template: `
    <example-chat-layout sidebarWidth="w-80">
      <chat main [agent]="agent" class="flex-1 min-w-0" />
      <div sidebar class="p-4 space-y-4" style="background: var(--ngaf-chat-bg); color: var(--ngaf-chat-text);">
        <h3 class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--ngaf-chat-text-muted);">Interrupt Panel</h3>
        <chat-interrupt-panel [agent]="agent" (action)="onInterruptAction($event)" />
        <div class="mt-4">
          <h4 class="text-xs font-semibold uppercase tracking-wide mb-2"
              style="color: var(--ngaf-chat-text-muted);">Stream Status</h4>
          <p class="text-xs font-mono" style="color: var(--ngaf-chat-text-muted);">{{ streamStatus() }}</p>
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

  protected onInterruptAction(action: InterruptAction): void {
    if (action === 'accept') {
      this.agent.submit({ resume: 'confirm' });
    } else if (action === 'ignore') {
      this.agent.submit({ resume: 'cancel' });
    }
    // 'edit' and 'respond' are intentionally unhandled for the booking flow.
  }
}
