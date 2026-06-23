// SPDX-License-Identifier: MIT
import { DragDropModule } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ItineraryStore } from './itinerary-store';

/**
 * The user-facing side of the frontend-owned itinerary: a panel that reads and
 * writes the shared `ItineraryStore`. The agent's client tools write the same
 * store, so an agent edit re-renders these rows immediately (no round-trip).
 */
@Component({
  selector: 'app-itinerary-panel',
  standalone: true,
  imports: [DragDropModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'itin', role: 'region', 'aria-label': 'Trip itinerary' },
  template: `
    <div class="itin__head">
      <h2 class="itin__title">Trip itinerary</h2>
      <button type="button" class="itin__reset" (click)="store.reset()">Reset demo data</button>
    </div>

    @for (g of store.days(); track g.day) {
      <section class="itin__day">
        <h3 class="itin__day-title">Day {{ g.day }}</h3>
        <ul class="itin__stops">
          @for (s of g.stops; track s.id) {
            <li class="itin__stop">
              <span class="itin__place">
                {{ s.place }}
                @if (s.note) { <span class="itin__note">— {{ s.note }}</span> }
              </span>
              <button
                type="button"
                class="itin__remove"
                [attr.aria-label]="'Remove ' + s.place"
                (click)="store.remove(s.id)"
              >✕</button>
            </li>
          }
        </ul>
      </section>
    } @empty {
      <p class="itin__empty">No stops planned yet.</p>
    }

    <form class="itin__add" (submit)="addStop($event)">
      <input
        class="itin__add-day"
        type="number"
        min="1"
        [value]="newDay()"
        (input)="newDay.set(+$any($event.target).value || 1)"
        aria-label="Day"
      />
      <input
        class="itin__add-place"
        type="text"
        placeholder="Add a place"
        [value]="newPlace()"
        (input)="newPlace.set($any($event.target).value)"
        aria-label="Place"
      />
      <button type="submit" class="itin__add-btn">Add</button>
    </form>
  `,
  styles: [
    `
      :host {
        display: block;
        padding: 16px;
        font-size: var(--ngaf-chat-font-size-sm);
        color: var(--ngaf-chat-text);
        font-family: var(--ngaf-chat-font-family);
      }
      .itin__head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 12px;
      }
      .itin__title {
        margin: 0;
        font-size: 1rem;
        color: var(--ngaf-chat-text);
      }
      .itin__reset {
        font-size: 0.75rem;
        background: transparent;
        border: 1px solid var(--ngaf-chat-separator);
        border-radius: var(--ngaf-chat-radius-card);
        padding: 4px 8px;
        color: var(--ngaf-chat-text-muted);
        cursor: pointer;
      }
      .itin__reset:hover {
        color: var(--ngaf-chat-text);
        background: var(--ngaf-chat-surface-alt);
      }
      .itin__day {
        margin-bottom: 12px;
      }
      .itin__day-title {
        margin: 0 0 4px;
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--ngaf-chat-text-muted);
      }
      .itin__stops {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .itin__stop {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 6px 8px;
        border: 1px solid var(--ngaf-chat-separator);
        border-radius: var(--ngaf-chat-radius-card);
        background: var(--ngaf-chat-bg);
      }
      .itin__place { min-width: 0; }
      .itin__note { color: var(--ngaf-chat-text-muted); }
      .itin__remove {
        flex: none;
        background: transparent;
        border: none;
        color: var(--ngaf-chat-text-muted);
        cursor: pointer;
        font-size: 0.8rem;
        line-height: 1;
        padding: 2px 4px;
      }
      .itin__remove:hover { color: var(--ngaf-chat-text); }
      .itin__empty {
        color: var(--ngaf-chat-text-muted);
        margin: 8px 0;
      }
      .itin__add {
        display: flex;
        gap: 6px;
        margin-top: 12px;
      }
      .itin__add-day { width: 56px; }
      .itin__add-place { flex: 1 1 auto; min-width: 0; }
      .itin__add input {
        padding: 6px 8px;
        border: 1px solid var(--ngaf-chat-separator);
        border-radius: var(--ngaf-chat-radius-card);
        background: var(--ngaf-chat-bg);
        color: var(--ngaf-chat-text);
        font-family: inherit;
      }
      .itin__add-btn {
        flex: none;
        padding: 6px 12px;
        border: 1px solid transparent;
        border-radius: var(--ngaf-chat-radius-card);
        background: var(--ngaf-chat-primary);
        color: var(--ngaf-chat-on-primary);
        cursor: pointer;
        font-family: inherit;
      }
    `,
  ],
})
export class ItineraryPanelComponent {
  protected readonly store = inject(ItineraryStore);
  protected readonly newDay = signal(1);
  protected readonly newPlace = signal('');

  protected addStop(event: Event): void {
    event.preventDefault();
    const place = this.newPlace().trim();
    if (!place) return;
    this.store.add(this.newDay(), place);
    this.newPlace.set('');
  }
}
