// SPDX-License-Identifier: MIT
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { ViewProps } from '@threadplane/chat';
import { injectRenderHost } from '@threadplane/render';
import { confirmBookingSchema } from './schemas';

/**
 * The interactive component for the `confirm_booking` client tool (an `ask`).
 * The model fills `summary`; the user confirms or cancels; the chosen value is
 * announced via `injectRenderHost().result(...)` and becomes the tool result
 * that resumes the run.
 *
 * Once the ask resolves, the adapter writes the emitted `{ confirmed }` back
 * onto the local tool call, so this component re-renders with `confirmed` as a
 * prop (chat-tool-views spreads `{...args, ...result, status}` into it). When
 * `confirmed()` is defined we render a FROZEN line with no buttons; the live
 * interactive card only shows while `confirmed()` is still undefined.
 *
 * Input types for schema-derived props are anchored to `ViewProps<typeof
 * confirmBookingSchema>` — a schema change is a compile error here.
 */

/** Props this component receives from the `confirm_booking` schema. */
type ConfirmBookingProps = ViewProps<typeof confirmBookingSchema>;

@Component({
  selector: 'app-confirm-booking',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (confirmed() === undefined) {
      <div class="cb">
        <p class="cb__summary">{{ summary() }}</p>
        <div class="cb__actions">
          <button type="button" class="cb__btn cb__btn--primary" (click)="respond(true)">Confirm</button>
          <button type="button" class="cb__btn" (click)="respond(false)">Cancel</button>
        </div>
      </div>
    } @else if (confirmed() === true) {
      <div class="cb cb--resolved">
        <p class="cb__summary">Booking confirmed ✓</p>
      </div>
    } @else {
      <div class="cb cb--resolved">
        <p class="cb__summary">Booking cancelled</p>
      </div>
    }
  `,
  styles: [`
    .cb { border: 1px solid var(--tplane-chat-separator, #e5e7eb); border-radius: 12px; padding: 16px; max-width: 360px; }
    .cb__summary { margin: 0 0 12px; }
    .cb--resolved .cb__summary { margin: 0; opacity: 0.85; }
    .cb__actions { display: flex; gap: 8px; }
    .cb__btn { padding: 6px 14px; border-radius: 8px; border: 1px solid var(--tplane-chat-separator, #e5e7eb); background: transparent; color: inherit; cursor: pointer; }
    .cb__btn--primary { background: var(--tplane-chat-accent, #2563eb); color: #fff; border-color: transparent; }
  `],
})
export class ConfirmBookingComponent {
  // Schema-derived input — type anchored to ConfirmBookingProps.
  readonly summary = input<ConfirmBookingProps['summary']>();
  /** Spread back onto props after the ask resolves (undefined while interactive). */
  readonly confirmed = input<boolean | undefined>(undefined);
  private readonly host = injectRenderHost();
  protected respond(confirmed: boolean): void {
    this.host.result({ confirmed });
  }
}
