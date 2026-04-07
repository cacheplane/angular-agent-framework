// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component } from '@angular/core';
<<<<<<< HEAD
import { ChatComponent, ChatInterruptPanelComponent, type InterruptAction } from '@cacheplane/chat';
import { agent } from '@cacheplane/angular';
import { environment } from '../environments/environment';
=======
import { ChatComponent, ChatInterruptPanelComponent, type InterruptAction, views } from '@cacheplane/chat';
import { signalStateStore } from '@cacheplane/render';
import { agent } from '@cacheplane/angular';
import { environment } from '../environments/environment';
import { ApprovalCardComponent } from './views/approval-card.component';
>>>>>>> origin/main

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
  imports: [ChatComponent, ChatInterruptPanelComponent],
  template: `
    <div class="flex flex-col h-screen">
<<<<<<< HEAD
      <chat [ref]="stream" class="flex-1 min-w-0" />
=======
      <chat [ref]="stream" [views]="ui" [store]="uiStore" class="flex-1 min-w-0" />
>>>>>>> origin/main
      @if (stream.interrupt()) {
        <div class="p-4" style="border-top: 1px solid var(--chat-border, #333);">
          <chat-interrupt-panel [ref]="stream" (action)="onInterruptAction($event)" />
        </div>
      }
    </div>
  `,
})
export class InterruptsComponent {
<<<<<<< HEAD
=======
  readonly ui = views({
    'approval-card': ApprovalCardComponent,
  });

  readonly uiStore = signalStateStore({});

>>>>>>> origin/main
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
    this.stream.submit(null);
  }
}
