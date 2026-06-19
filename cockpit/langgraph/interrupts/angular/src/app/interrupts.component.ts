// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { ChatComponent, ChatApprovalCardComponent, ChatWelcomeSuggestionComponent, type ChatApprovalAction } from '@threadplane/chat';
import { injectAgent } from '@threadplane/langgraph';
import { ExampleChatLayoutComponent } from '@threadplane/example-layouts';
import { CurrencyPipe } from '@angular/common';

const WELCOME_SUGGESTIONS = [
  // label asserted by e2e (interrupts.spec.ts page.getByText) — do not change.
  {
    label: 'Refund a duplicate charge',
    value: 'Refund $47.50 to customer cus_a8x2k — they were charged twice for the same order.',
    description: 'Graph pauses at request_approval; approve or edit the amount in the modal.',
  },
  {
    label: 'Refund a chargeback',
    value: 'Refund $129.00 to customer cus_z19fp who opened a chargeback for unrecognized activity.',
    description: 'Chargeback path — same interrupt pattern with a different reason string.',
  },
] as const;

/**
 * Refund authorization cockpit example.
 *
 * The LangGraph backend acknowledges the refund draft, then pauses at
 * `request_approval` with a structured interrupt payload of the form
 * `{ kind: 'refund_approval', amount, customer_id, reason }`.
 *
 * The frontend uses `ChatApprovalCardComponent` to render the native-dialog
 * modal and emit a `ChatApprovalAction` ('approve' | 'edit' | 'cancel').
 * The handler maps each action to a structured resume payload back to the
 * graph.
 *
 * The agent is wired in `app.config.ts` via `provideAgent({...})` and
 * retrieved here with `injectAgent()`.
 */
@Component({
  selector: 'app-interrupts',
  standalone: true,
  imports: [
    ChatComponent,
    ChatApprovalCardComponent,
    ChatWelcomeSuggestionComponent,
    ExampleChatLayoutComponent,
    CurrencyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <example-chat-layout>
      <div main class="flex flex-col h-full">
        <chat [agent]="agent" class="flex-1 min-w-0">
          <div chatWelcomeSuggestions>
            @for (s of suggestions; track s.value) {
              <chat-welcome-suggestion
                [label]="s.label"
                [value]="s.value"
                [description]="s.description"
                (selected)="send($event)"
              />
            }
          </div>
        </chat>

        <chat-approval-card
          [agent]="agent"
          matchKind="refund_approval"
          title="Refund approval required"
          [showEdit]="true"
          (action)="onAction($event)"
        >
          <ng-template #body let-payload>
            <div style="display:flex; flex-direction:column; gap:6px;">
              <div><span style="color:var(--ngaf-chat-text-muted); margin-right:6px;">Amount</span><strong>{{ payload.amount | currency }}</strong></div>
              <div><span style="color:var(--ngaf-chat-text-muted); margin-right:6px;">Customer</span><code>{{ payload.customer_id }}</code></div>
              @if (payload.reason) {
                <div style="font-style:italic; color:var(--ngaf-chat-text-muted); margin-top:4px;">{{ payload.reason }}</div>
              }
              @if (editing()) {
                <div style="margin-top:10px; display:flex; gap:6px; align-items:center;">
                  <label style="color:var(--ngaf-chat-text-muted); font-size:12px;">Edit amount</label>
                  <input type="number" step="0.01" [value]="editAmount() ?? payload.amount" (input)="editAmount.set(+($any($event.target).value))" style="padding:4px 8px; border:1px solid var(--ngaf-chat-separator); border-radius:6px; width:120px;" />
                  <button type="button" (click)="submitEdit(payload)" style="padding:4px 10px; background:var(--ngaf-chat-primary); color:var(--ngaf-chat-on-primary); border:0; border-radius:6px; font-size:12px; cursor:pointer;">Save</button>
                </div>
              }
            </div>
          </ng-template>
        </chat-approval-card>
      </div>
    </example-chat-layout>
  `,
})
export class InterruptsComponent {
  protected readonly suggestions = WELCOME_SUGGESTIONS;
  protected readonly editing = signal(false);
  protected readonly editAmount = signal<number | null>(null);

  protected readonly agent = injectAgent();

  protected send(text: string): void {
    void this.agent.submit({ message: text });
  }

  protected onAction(action: ChatApprovalAction): void {
    if (action === 'approve') {
      void this.agent.submit({ resume: { approved: true } });
      this.resetEdit();
    } else if (action === 'cancel') {
      void this.agent.submit({ resume: { approved: false } });
      this.resetEdit();
    } else if (action === 'edit') {
      this.editing.set(true);
    }
  }

  protected submitEdit(payload: { amount: number }): void {
    const next = this.editAmount() ?? payload.amount;
    void this.agent.submit({ resume: { approved: true, amount: next } });
    this.resetEdit();
  }

  private resetEdit(): void {
    this.editing.set(false);
    this.editAmount.set(null);
  }
}
