import { Component } from '@angular/core';
import { ChatComponent } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

/**
 * InterruptsComponent demonstrates human-in-the-loop with `streamResource()`.
 *
 * The LangGraph backend pauses execution when it needs human approval.
 * The `stream.interrupt()` signal provides the interrupt data, and
 * `stream.submit()` resumes execution with the human's decision.
 *
 * Key integration points:
 * - `stream.interrupt()` — current pause data
 * - `stream.submit({ resume: true })` — resume after approval
 * - The graph uses LangGraph's `interrupt()` function to pause
 */
@Component({
  selector: 'app-interrupts',
  standalone: true,
  imports: [ChatComponent],
  template: `
    <cp-chat
      [messages]="stream.messages()"
      [isLoading]="stream.isLoading()"
      [error]="stream.error()"
      (sendMessage)="send($event)">
      <ng-template #sidebar>
        <h3 style="font-size: 0.8rem; font-weight: 600; margin-bottom: 0.75rem; color: #1a1a2e;">Approvals</h3>
        @if (stream.interrupt()) {
          <div style="padding: 8px; border: 1px solid rgba(0,64,144,0.15); border-radius: 6px; margin-bottom: 0.75rem; font-size: 0.8rem; color: #1a1a2e;">
            <p style="margin: 0 0 8px 0;">{{ stream.interrupt() }}</p>
            <button (click)="approve()"
                    style="padding: 6px 10px; border: none; border-radius: 6px; background: #004090; color: white; cursor: pointer; font-size: 0.75rem; margin-right: 4px;">
              Approve
            </button>
            <button (click)="reject()"
                    style="padding: 6px 10px; border: 1px solid rgba(0,64,144,0.15); border-radius: 6px; background: none; cursor: pointer; font-size: 0.75rem; color: #004090;">
              Reject
            </button>
          </div>
        } @else {
          <p style="font-size: 0.8rem; color: #555770;">No pending approvals</p>
        }
      </ng-template>
    </cp-chat>
  `,
})
export class InterruptsComponent {
  /**
   * The streaming resource with interrupt support.
   *
   * When the LangGraph backend calls `interrupt()`, the `stream.interrupt()`
   * signal emits the interrupt payload for display in the sidebar.
   */
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  /**
   * Submit a message to the assistant.
   */
  send(text: string): void {
    this.stream.submit({ messages: [{ role: 'human', content: text }] });
  }

  /**
   * Approve the pending action and resume execution.
   * Submitting null continues the graph (LangGraph convention).
   */
  approve(): void {
    this.stream.submit(null);
  }

  /**
   * Reject the pending action. Sends a resume value of false
   * so the graph can handle rejection logic.
   */
  reject(): void {
    this.stream.submit({ resume: false });
  }
}
