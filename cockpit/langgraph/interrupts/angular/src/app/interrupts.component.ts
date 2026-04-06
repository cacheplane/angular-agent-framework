// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component } from '@angular/core';
import { ChatComponent, ChatInterruptPanelComponent, type InterruptAction } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

/**
 * InterruptsComponent demonstrates human-in-the-loop with `streamResource()`.
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
      <chat [ref]="stream" class="flex-1 min-w-0" />
      @if (stream.interrupt()) {
        <div class="p-4" style="border-top: 1px solid var(--chat-border, #333);">
          <chat-interrupt-panel [ref]="stream" (action)="onInterruptAction($event)" />
        </div>
      }
    </div>
  `,
})
export class InterruptsComponent {
  /**
   * The streaming resource with interrupt support.
   *
   * When the LangGraph backend calls `interrupt()`, the `stream.interrupt()`
   * signal emits the interrupt payload for display via ChatInterruptPanelComponent.
   */
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  /**
   * Handle an interrupt action from the panel.
   *
   * Submitting null resumes the graph unconditionally (LangGraph convention).
   * Tier 3 will add edit/respond flows with richer resume payloads.
   */
  protected onInterruptAction(action: InterruptAction): void {
    switch (action) {
      case 'accept':
        this.stream.submit(null);  // Resume with approval
        break;
      case 'ignore':
      case 'respond':
      case 'edit':
        // For now, just resume — Tier 3 will add edit/respond flows
        this.stream.submit(null);
        break;
    }
  }
}
