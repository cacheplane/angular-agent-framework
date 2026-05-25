// SPDX-License-Identifier: MIT
import { Component, computed } from '@angular/core';
import { JsonPipe } from '@angular/common';
import {
  ChatComponent,
  ChatInterruptPanelComponent,
  ChatWelcomeSuggestionComponent,
} from '@threadplane/chat';
import type { InterruptAction } from '@threadplane/chat';
import { ExampleChatLayoutComponent } from '@threadplane/example-layouts';
import { agent } from '@threadplane/langgraph';
import { environment } from '../environments/environment';

const SUGGESTIONS = [
  // values match cockpit/chat/interrupts/angular/e2e/c-interrupts.spec.ts.
  // Confirm flow: book + Accept → "Booked …"
  { label: 'Book UA123 (confirm)', value: 'Book me on UA123.' },
  // Cancel flow: book + Ignore → "Booking cancelled."
  { label: 'Book AA404 (cancel)', value: 'Book me on AA404.' },
] as const;

/**
 * InterruptsComponent demonstrates human-in-the-loop approval gates
 * using ChatComponent and ChatInterruptPanelComponent.
 *
 * Shows interrupt payload and action buttons in a sidebar panel.
 * Maps the panel's UI actions to LangGraph resume payloads:
 *   Accept  → resume('confirm')   — the book_flight tool returns Booked …
 *   Ignore  → resume('cancel')    — the book_flight tool returns Booking cancelled.
 * Edit / Respond are not wired for this demo's single-decision booking flow.
 *
 * Welcome chips let users one-click into either recorded aimock flow.
 * Chip labels hint at the modal action that produces the recorded path.
 */
@Component({
  selector: 'app-interrupts',
  standalone: true,
  imports: [
    ChatComponent,
    ChatInterruptPanelComponent,
    ChatWelcomeSuggestionComponent,
    JsonPipe,
    ExampleChatLayoutComponent,
  ],
  template: `
    <example-chat-layout sidebarWidth="w-80">
      <chat main [agent]="agent" class="flex-1 min-w-0">
        <div chatWelcomeSuggestions>
          @for (s of suggestions; track s.value) {
            <chat-welcome-suggestion
              [label]="s.label"
              [value]="s.value"
              (selected)="send($event)"
            />
          }
        </div>
      </chat>
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
  protected readonly suggestions = SUGGESTIONS;

  protected onInterruptAction(action: InterruptAction): void {
    if (action === 'accept') {
      this.agent.submit({ resume: 'confirm' });
    } else if (action === 'ignore') {
      this.agent.submit({ resume: 'cancel' });
    }
    // 'edit' and 'respond' are intentionally unhandled for the booking flow.
  }

  protected send(text: string): void {
    void this.agent.submit({ message: text });
  }
}
