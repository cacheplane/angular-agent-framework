// SPDX-License-Identifier: MIT
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { injectRenderHost } from '@threadplane/render';

/**
 * The interactive component for the `confirm_booking` client tool (an `ask`).
 * The model fills `summary`; the user confirms or cancels; the chosen value is
 * announced via `injectRenderHost().result(...)` and becomes the tool result
 * that resumes the run.
 */
@Component({
  selector: 'app-confirm-booking',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cb">
      <p class="cb__summary">{{ summary() }}</p>
      <div class="cb__actions">
        <button type="button" class="cb__btn cb__btn--primary" (click)="respond(true)">Confirm</button>
        <button type="button" class="cb__btn" (click)="respond(false)">Cancel</button>
      </div>
    </div>
  `,
  styles: [`
    .cb { border: 1px solid var(--ngaf-chat-separator, #e5e7eb); border-radius: 12px; padding: 16px; max-width: 360px; }
    .cb__summary { margin: 0 0 12px; }
    .cb__actions { display: flex; gap: 8px; }
    .cb__btn { padding: 6px 14px; border-radius: 8px; border: 1px solid var(--ngaf-chat-separator, #e5e7eb); background: transparent; color: inherit; cursor: pointer; }
    .cb__btn--primary { background: var(--ngaf-chat-accent, #2563eb); color: #fff; border-color: transparent; }
  `],
})
export class ConfirmBookingComponent {
  readonly summary = input<string>();
  private readonly host = injectRenderHost();
  protected respond(confirmed: boolean): void {
    this.host.result({ confirmed });
  }
}
