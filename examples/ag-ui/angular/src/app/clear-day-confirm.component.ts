// SPDX-License-Identifier: MIT
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { injectRenderHost } from '@threadplane/render';
import { ItineraryStore } from './itinerary-store';

/**
 * The interactive component for the `clear_day` client tool (an `ask`). The
 * model fills `day`; the user confirms or cancels. Because an ask emits the
 * tool result and the handler layer cannot intercept it, the mutation happens
 * HERE: Clear writes the shared `ItineraryStore` (so the panel updates live)
 * and then announces the outcome via `injectRenderHost().result(...)`, which
 * becomes the tool result that resumes the run. Cancel never touches the store.
 */
@Component({
  selector: 'app-clear-day-confirm',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cdc">
      <p class="cdc__summary">Clear all {{ count() }} stops on day {{ day() }}?</p>
      <div class="cdc__actions">
        <button type="button" class="cdc__btn cdc__btn--primary" (click)="clear()">Clear</button>
        <button type="button" class="cdc__btn" (click)="cancel()">Cancel</button>
      </div>
    </div>
  `,
  styles: [
    `
      .cdc {
        border: 1px solid var(--ngaf-chat-separator, #e5e7eb);
        border-radius: 12px;
        padding: 16px;
        max-width: 360px;
      }
      .cdc__summary {
        margin: 0 0 12px;
      }
      .cdc__actions {
        display: flex;
        gap: 8px;
      }
      .cdc__btn {
        padding: 6px 14px;
        border-radius: 8px;
        border: 1px solid var(--ngaf-chat-separator, #e5e7eb);
        background: transparent;
        color: inherit;
        cursor: pointer;
      }
      .cdc__btn--primary {
        background: var(--ngaf-chat-accent, #2563eb);
        color: #fff;
        border-color: transparent;
      }
    `,
  ],
})
export class ClearDayConfirmComponent {
  readonly day = input.required<number>();
  private readonly store = inject(ItineraryStore);
  private readonly host = injectRenderHost();

  protected readonly count = computed(
    () => this.store.stops().filter((s) => s.day === this.day()).length,
  );

  protected clear(): void {
    const day = this.day();
    const removed = this.store.clearDay(day);
    this.host.result({ cleared: true, day, removed });
  }

  protected cancel(): void {
    this.host.result({ cleared: false, day: this.day() });
  }
}
