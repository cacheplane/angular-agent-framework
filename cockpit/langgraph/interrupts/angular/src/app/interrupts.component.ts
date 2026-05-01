// SPDX-License-Identifier: MIT
import { Component } from '@angular/core';
import { ChatComponent, ChatInterruptPanelComponent, views, type InterruptAction } from '@ngaf/chat';
import { agent, toAgent } from '@ngaf/langgraph';
import { ExampleChatLayoutComponent } from '@ngaf/example-layouts';
import { signalStateStore } from '@ngaf/render';
import { environment } from '../environments/environment';
import { ApprovalCardComponent } from './views/approval-card.component';

/**
 * InterruptsComponent demonstrates human-in-the-loop with `agent()`.
 *
 * The LangGraph backend pauses execution when it needs human approval.
 * The `stream.interrupt()` signal provides the interrupt data, and
 * `stream.submit(null)` resumes execution with the human's decision.
 *
 * Key integration points:
 * - `stream.interrupt()` — current pause data (undefined when not interrupted)
 * - `ChatInterruptPanelComponent` — renders the approval UI with action buttons
 * - `stream.submit(null)` — resumes the graph (LangGraph convention)
 */
@Component({
  selector: 'app-interrupts',
  standalone: true,
  imports: [ChatComponent, ChatInterruptPanelComponent, ExampleChatLayoutComponent],
  template: `
    <example-chat-layout>
      <div main class="flex flex-col h-full">
        <chat [agent]="chatAgent" [views]="ui" [store]="uiStore" class="flex-1 min-w-0" />
        @if (chatAgent.interrupt()) {
          <div class="p-4" style="border-top: 1px solid var(--chat-border, #333);">
            <chat-interrupt-panel [agent]="chatAgent" (action)="onInterruptAction($event)" />
          </div>
        }
      </div>
    </example-chat-layout>
  `,
})
export class InterruptsComponent {
  readonly ui = views({ 'approval-card': ApprovalCardComponent });
  readonly uiStore = signalStateStore({});

  /**
   * The streaming resource with interrupt support.
   *
   * When the LangGraph backend calls `interrupt()`, the `stream.interrupt()`
   * signal emits the interrupt payload for display via ChatInterruptPanelComponent.
   */
  protected readonly stream = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });
  protected readonly chatAgent = toAgent(this.stream);

  /**
   * Handle an interrupt action from the panel.
   *
   * Submitting null resumes the graph unconditionally — this is the
   * LangGraph convention for "proceed without modification".
   *
   * In a production app, 'edit' would let the user modify the response
   * before approval, and 'respond' would send a reply payload.
   * For this demo, all actions simply resume the graph.
   */
  protected onInterruptAction(action: InterruptAction): void {
    // In a production app, 'edit' would let the user modify the response before approval.
    // For this demo, all actions simply resume the graph.
    void action; // Each branch intentionally does the same thing in this demo
    void this.chatAgent.submit({ resume: null });
  }
}
