// SPDX-License-Identifier: MIT
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * A frontend-owned view rendered for the `day_card` client tool. The model
 * fills `day` and `places`; this card recaps one itinerary day after an edit.
 */
@Component({
  selector: 'app-day-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dc">
      <div class="dc__head">Day {{ day() }}</div>
      <ul class="dc__list">
        @for (p of places(); track p) {
          <li class="dc__item">{{ p }}</li>
        } @empty {
          <li class="dc__item dc__item--empty">No stops</li>
        }
      </ul>
    </div>
  `,
  styles: [
    `
      .dc {
        border: 1px solid var(--ngaf-chat-separator, #e5e7eb);
        border-radius: 12px;
        padding: 16px;
        max-width: 280px;
      }
      .dc__head {
        font-weight: 600;
        margin-bottom: 8px;
      }
      .dc__list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .dc__item {
        opacity: 0.9;
      }
      .dc__item--empty {
        opacity: 0.5;
      }
    `,
  ],
})
export class DayCardComponent {
  readonly day = input.required<number>();
  readonly places = input<string[]>([]);
}
