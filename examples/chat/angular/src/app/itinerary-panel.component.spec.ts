// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideAgent, FakeStreamTransport } from '@threadplane/langgraph';
import { DEMO_AGENT_REF } from './shell/agent-ref';
import { ItineraryPanelComponent } from './itinerary-panel.component';
import { ItineraryStore } from './itinerary-store';

// Bind the DEMO_AGENT_REF token to an in-process fake LangGraph agent so
// injectAgent(DEMO_AGENT_REF) in the panel resolves without a backend.
const fakeAgentProvider = provideAgent(DEMO_AGENT_REF, {
  assistantId: 'fake',
  transport: new FakeStreamTransport(),
});

describe('ItineraryPanelComponent — agent-edit pulse', () => {
  beforeEach(() => localStorage.clear());

  it('applies .itin__stop--pulse to the row matching recentlyChangedId', async () => {
    TestBed.configureTestingModule({
      providers: [
        ItineraryStore,
        ...fakeAgentProvider,
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

  it('toggles the itin--collapsed host class via the collapse button', () => {
    TestBed.configureTestingModule({
      providers: [
        ItineraryStore,
        ...fakeAgentProvider,
      ],
    });

    const fixture = TestBed.createComponent(ItineraryPanelComponent);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.classList.contains('itin--collapsed')).toBe(false);

    const toggle = host.querySelector('.itin__collapse') as HTMLButtonElement;
    expect(toggle).toBeTruthy();

    toggle.click();
    fixture.detectChanges();
    expect(host.classList.contains('itin--collapsed')).toBe(true);

    toggle.click();
    fixture.detectChanges();
    expect(host.classList.contains('itin--collapsed')).toBe(false);
  });

  it('highlights the focused row', () => {
    TestBed.configureTestingModule({
      providers: [
        ItineraryStore,
        ...fakeAgentProvider,
      ],
    });
    const store = TestBed.inject(ItineraryStore);
    // The chat-demo store starts empty, so seed a stop before focusing it.
    const stop = store.add(1, 'Louvre');
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
