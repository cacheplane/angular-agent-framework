// SPDX-License-Identifier: MIT
import { Component } from '@angular/core';
import { ChatComponent, ChatInterruptPanelComponent, ChatWelcomeSuggestionComponent, views, type InterruptAction } from '@threadplane/chat';
import { agent } from '@threadplane/langgraph';
import { ExampleChatLayoutComponent } from '@threadplane/example-layouts';
import { signalStateStore } from '@threadplane/render';
import { environment } from '../environments/environment';
import { ApprovalCardComponent } from './views/approval-card.component';

const WELCOME_SUGGESTIONS = [
  { label: 'Approve a tool call', value: 'Book a flight to Paris for next Tuesday.' },
] as const;

/**
 * InterruptsComponent demonstrates human-in-the-loop with `agent()`.
 *
 * The LangGraph backend pauses execution when it needs human approval.
 * The `stream.interrupt()` signal provides the interrupt data, and
 * `stream.submit({ resume })` resumes execution with the human's decision.
 *
 * Key integration points:
 * - `stream.interrupt()` — current pause data (undefined when not interrupted)
 * - `ChatInterruptPanelComponent` — renders the approval UI with action buttons
 * - `stream.submit({ resume })` — resumes the graph with a payload
 */
@Component({
  selector: 'app-interrupts',
  standalone: true,
  imports: [ChatComponent, ChatInterruptPanelComponent, ChatWelcomeSuggestionComponent, ExampleChatLayoutComponent],
  template: `
    <example-chat-layout>
      <div main class="flex flex-col h-full">
        <chat [agent]="agent" [views]="ui" [store]="uiStore" class="flex-1 min-w-0">
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
        @if (agent.interrupt()) {
          <div class="p-4" style="border-top: 1px solid var(--ngaf-chat-separator);">
            <chat-interrupt-panel [agent]="agent" (action)="onInterruptAction($event)" />
          </div>
        }
      </div>
    </example-chat-layout>
  `,
})
export class InterruptsComponent {
  readonly ui = views({ 'approval-card': ApprovalCardComponent });
  readonly uiStore = signalStateStore({});
  protected readonly suggestions = WELCOME_SUGGESTIONS;

  protected send(text: string): void {
    void this.agent.submit({ message: text });
  }

  /**
   * The streaming resource with interrupt support.
   *
   * When the LangGraph backend calls `interrupt()`, the `stream.interrupt()`
   * signal emits the interrupt payload for display via ChatInterruptPanelComponent.
   */
  protected readonly agent = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  /**
   * Handle an interrupt action from the panel.
   *
   * Submitting a resume payload continues the graph.
   *
   * In a production app, 'edit' would let the user modify the response
   * before approval, and 'respond' would send a reply payload.
   * For this demo, all actions simply resume the graph.
   */
  protected onInterruptAction(action: InterruptAction): void {
    // In a production app, 'edit' would let the user modify the response before approval.
    // For this demo, all actions simply resume the graph.
    void action; // Each branch intentionally does the same thing in this demo
    void this.agent.submit({ resume: true });
  }
}
