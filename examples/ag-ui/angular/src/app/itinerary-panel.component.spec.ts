// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideAgent } from '@threadplane/ag-ui';
import { ITINERARY_AGENT } from './client-tools';
import { ItineraryPanelComponent } from './itinerary-panel.component';
import { ItineraryStore } from './itinerary-store';

describe('ItineraryPanelComponent — agent-edit pulse', () => {
  beforeEach(() => localStorage.clear());

  it('applies .itin__stop--pulse to the row matching recentlyChangedId', async () => {
    TestBed.configureTestingModule({
      providers: [
        ItineraryStore,
        provideAgent(ITINERARY_AGENT, { url: '/__test__' }),
      ],
    });
    const store = TestBed.inject(ItineraryStore);
    const added = store.add(3, 'Sacré-Cœur'); // agent source by default

    const fixture = TestBed.createComponent(ItineraryPanelComponent);
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('.itin__stop');
    const pulsing = Array.from(rows).filter((el: any) =>
      el.classList.contains('itin__stop--pulse'),
    );
    expect(pulsing.length).toBe(1);
    expect((pulsing[0] as HTMLElement).textContent).toContain('Sacré-Cœur');
    // satisfy lint
    expect(added.id).toBeDefined();
  });

  it('highlights the focused row', () => {
    TestBed.configureTestingModule({
      providers: [
        ItineraryStore,
        provideAgent(ITINERARY_AGENT, { url: '/__test__' }),
      ],
    });
    const store = TestBed.inject(ItineraryStore);
    const stop = store.stops()[0];
    store.focus(stop.id);

    const fixture = TestBed.createComponent(ItineraryPanelComponent);
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('.itin__stop');
    const pulsing = Array.from(rows).filter((el: any) =>
      el.classList.contains('itin__stop--pulse'),
    );
    expect(pulsing.length).toBe(1);
  });
});
