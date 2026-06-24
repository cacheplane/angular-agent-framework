# AG-UI Itinerary Redesign — Phase 1: Productize the Panel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin and re-architect the AG-UI demo's trip-itinerary panel onto chat-library tokens, with `@angular/cdk` drag-to-reorder, an agent-edit pulse, per-day add affordance, polished empty state, and a `reorder_stop` client tool.

**Architecture:** All work lives in [`examples/ag-ui/angular`](../../../examples/ag-ui/angular/). The store (`ItineraryStore`) gains a `source` discriminator on its mutators, a `reorder()` method, and a `recentlyChangedId` signal. The panel component is rewritten around `cdkDropListGroup` + `cdkDropList`. Tokens shift from `--tp-border`/`--a2ui-primary` to `--ngaf-chat-*`. The Phase-1 work ships as a single PR; Phase 2 starts after merge.

**Tech Stack:** Angular 21.1 (zoneless), `@angular/cdk` 21 (drag-drop), Material Symbols font (already loaded by the a2ui catalog), Vitest for unit tests, Playwright for e2e.

**Reference:** [docs/superpowers/specs/2026-06-22-ag-ui-itinerary-redesign-design.md](../specs/2026-06-22-ag-ui-itinerary-redesign-design.md) — Phase 1 sections.

---

## Task 1: Extend `ItineraryStore` with `source`, `reorder()`, and `recentlyChangedId`

**Files:**
- Modify: `examples/ag-ui/angular/src/app/itinerary-store.ts`
- Test: `examples/ag-ui/angular/src/app/itinerary-store.spec.ts`

The store today exposes `add/move/remove/clearDay/reset` with no notion of *who* mutated it. Phase 1 introduces a `source: 'user' | 'agent'` parameter (default `'agent'`) and a derived signal `recentlyChangedId` set only when `source === 'agent'`. Adds `reorder(stopId, toDay, toIndex)` for cross-day and within-day reorder.

- [ ] **Step 1: Write failing tests for `reorder` and `recentlyChangedId`**

Append to `examples/ag-ui/angular/src/app/itinerary-store.spec.ts`:

```ts
describe('reorder', () => {
  it('moves a stop to a new index within the same day', () => {
    const s = new ItineraryStore();
    // seed: day 1 has [Louvre, Eiffel]
    const eiffel = s.stops().find((x) => x.place === 'Eiffel Tower')!;
    s.reorder(eiffel.id, 1, 0);
    const day1 = s.days().find((g) => g.day === 1)!;
    expect(day1.stops.map((x) => x.place)).toEqual(['Eiffel Tower', 'Louvre']);
  });

  it('moves a stop across days at a specific index', () => {
    const s = new ItineraryStore();
    const orsay = s.stops().find((x) => x.place === "Musée d'Orsay")!;
    s.reorder(orsay.id, 1, 0);
    const day1 = s.days().find((g) => g.day === 1)!;
    expect(day1.stops[0].place).toBe("Musée d'Orsay");
    expect(day1.stops[0].day).toBe(1);
  });

  it('reorder by unknown id is a no-op', () => {
    const s = new ItineraryStore();
    const before = s.stops();
    s.reorder('does-not-exist', 1, 0);
    expect(s.stops()).toEqual(before);
  });
});

describe('recentlyChangedId', () => {
  it('is null initially', () => {
    const s = new ItineraryStore();
    expect(s.recentlyChangedId()).toBeNull();
  });

  it('is set after an agent-source add', () => {
    const s = new ItineraryStore();
    const added = s.add(3, 'Sacré-Cœur');
    expect(s.recentlyChangedId()).toBe(added.id);
  });

  it('is NOT set after a user-source add', () => {
    const s = new ItineraryStore();
    s.add(3, 'Sacré-Cœur', undefined, { source: 'user' });
    expect(s.recentlyChangedId()).toBeNull();
  });

  it('clears 1600ms after the change', async () => {
    vi.useFakeTimers();
    const s = new ItineraryStore();
    s.add(3, 'Sacré-Cœur');
    expect(s.recentlyChangedId()).not.toBeNull();
    vi.advanceTimersByTime(1600);
    expect(s.recentlyChangedId()).toBeNull();
    vi.useRealTimers();
  });
});
```

Make sure the existing `import` line at the top of the spec includes `vi`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm nx test examples-ag-ui-angular --testFile=itinerary-store.spec.ts`
Expected: FAIL — `recentlyChangedId is not a function`, `reorder is not a function`.

- [ ] **Step 3: Implement `reorder`, `recentlyChangedId`, and the `source` option**

Replace `examples/ag-ui/angular/src/app/itinerary-store.ts` with:

```ts
// SPDX-License-Identifier: MIT
import { computed, signal } from '@angular/core';

export interface ItineraryStop {
  id: string;
  day: number;
  place: string;
  note?: string;
}

export interface MutationOptions {
  source?: 'user' | 'agent';
}

export const ITINERARY_STORAGE_KEY = 'ag-ui-demo:itinerary';
const PULSE_MS = 1600;

const SEED: ItineraryStop[] = [
  { id: 'seed-1', day: 1, place: 'Louvre', note: 'book tickets' },
  { id: 'seed-2', day: 1, place: 'Eiffel Tower' },
  { id: 'seed-3', day: 2, place: "Musée d'Orsay" },
];

/** Frontend-owned demo state: the user edits it in the panel, the agent edits
 *  it through client tools. Both write the same signals, so either's changes
 *  render immediately. Persisted to localStorage so it survives reload. */
export class ItineraryStore {
  readonly stops = signal<ItineraryStop[]>(this.hydrate());
  readonly days = computed(() => {
    const byDay = new Map<number, ItineraryStop[]>();
    for (const s of this.stops()) byDay.set(s.day, [...(byDay.get(s.day) ?? []), s]);
    return [...byDay.entries()]
      .sort(([a], [b]) => a - b)
      .map(([day, stops]) => ({ day, stops }));
  });
  readonly recentlyChangedId = signal<string | null>(null);
  private pulseTimer: ReturnType<typeof setTimeout> | null = null;

  add(day: number, place: string, note?: string, opts?: MutationOptions): ItineraryStop {
    const stop: ItineraryStop = {
      id: crypto.randomUUID(),
      day,
      place,
      ...(note ? { note } : {}),
    };
    this.update([...this.stops(), stop]);
    this.flagChanged(stop.id, opts);
    return stop;
  }

  move(place: string, toDay: number, opts?: MutationOptions): ItineraryStop | undefined {
    const target = this.stops().find((s) => s.place.toLowerCase() === place.toLowerCase());
    if (!target) return undefined;
    const moved = { ...target, day: toDay };
    this.update(this.stops().map((s) => (s.id === target.id ? moved : s)));
    this.flagChanged(moved.id, opts);
    return moved;
  }

  reorder(stopId: string, toDay: number, toIndex: number, opts?: MutationOptions): void {
    const current = this.stops();
    const target = current.find((s) => s.id === stopId);
    if (!target) return;
    const without = current.filter((s) => s.id !== stopId);
    const dayStops = without.filter((s) => s.day === toDay);
    const others = without.filter((s) => s.day !== toDay);
    const clampedIndex = Math.max(0, Math.min(toIndex, dayStops.length));
    const newDayStops = [
      ...dayStops.slice(0, clampedIndex),
      { ...target, day: toDay },
      ...dayStops.slice(clampedIndex),
    ];
    this.update([...others, ...newDayStops]);
    this.flagChanged(stopId, opts);
  }

  remove(id: string, opts?: MutationOptions): void {
    this.update(this.stops().filter((s) => s.id !== id));
    this.flagChanged(id, opts);
  }

  clearDay(day: number, opts?: MutationOptions): number {
    const removed = this.stops().filter((s) => s.day === day).length;
    this.update(this.stops().filter((s) => s.day !== day));
    if (removed > 0) this.flagChanged(null, opts);
    return removed;
  }

  reset(opts?: MutationOptions): void {
    this.update([...SEED]);
    this.flagChanged(null, opts);
  }

  private flagChanged(id: string | null, opts?: MutationOptions): void {
    if (opts?.source === 'user') return;
    if (this.pulseTimer) clearTimeout(this.pulseTimer);
    this.recentlyChangedId.set(id);
    if (id !== null) {
      this.pulseTimer = setTimeout(() => {
        this.recentlyChangedId.set(null);
        this.pulseTimer = null;
      }, PULSE_MS);
    }
  }

  private update(next: ItineraryStop[]): void {
    this.stops.set(next);
    try {
      localStorage.setItem(ITINERARY_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* private mode */
    }
  }

  private hydrate(): ItineraryStop[] {
    try {
      const raw = localStorage.getItem(ITINERARY_STORAGE_KEY);
      if (raw) return JSON.parse(raw) as ItineraryStop[];
    } catch {
      /* fall through to seed */
    }
    return [...SEED];
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm nx test examples-ag-ui-angular --testFile=itinerary-store.spec.ts`
Expected: PASS — all old and new tests green.

- [ ] **Step 5: Commit**

```bash
git add examples/ag-ui/angular/src/app/itinerary-store.ts examples/ag-ui/angular/src/app/itinerary-store.spec.ts
git commit -m "feat(ag-ui): extend ItineraryStore with reorder, source, recentlyChangedId"
```

---

## Task 2: Install `@angular/cdk` and import `DragDropModule`

**Files:**
- Modify: `package.json` (root)
- Modify: `examples/ag-ui/angular/src/app/itinerary-panel.component.ts`

Add the CDK package and verify it imports cleanly. No drag behavior is wired yet — that's Task 6.

- [ ] **Step 1: Add `@angular/cdk` to root `package.json`**

Open `package.json` at the repo root, find the `dependencies` block, and add `"@angular/cdk": "~21.1.0"` alphabetically next to `"@angular/core"`. Use the SAME minor as `@angular/core` (today `~21.1.0`; verify with `grep '"@angular/core"' package.json`).

- [ ] **Step 2: Install**

Run: `pnpm install`
Expected: lockfile updates, no errors. (Note from project memory: never re-generate `package-lock.json` from scratch on macOS — `pnpm install` updates `pnpm-lock.yaml` in place, which is safe.)

- [ ] **Step 3: Import `DragDropModule` in the panel component**

Edit `examples/ag-ui/angular/src/app/itinerary-panel.component.ts`. Add the import and add the module to the component's `imports` array (component is currently standalone with no `imports` — add the array):

```ts
import { DragDropModule } from '@angular/cdk/drag-drop';
// ...
@Component({
  selector: 'app-itinerary-panel',
  standalone: true,
  imports: [DragDropModule],
  // ...rest unchanged for now
})
```

- [ ] **Step 4: Build the example to verify the dep resolves**

Run: `pnpm nx build examples-ag-ui-angular --configuration=development`
Expected: build succeeds with no module-not-found errors.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml examples/ag-ui/angular/src/app/itinerary-panel.component.ts
git commit -m "build(ag-ui): add @angular/cdk drag-drop dependency"
```

---

## Task 3: Replace `--tp-border` / `--a2ui-primary` with chat library tokens

**Files:**
- Modify: `examples/ag-ui/angular/src/app/itinerary-panel.component.ts` (styles only)

Tokens swap, no DOM restructure yet. This isolates the visual repaint from the structural rebuild so a regression is bisectable.

- [ ] **Step 1: Update the `styles:` array in the panel component**

In `examples/ag-ui/angular/src/app/itinerary-panel.component.ts`, replace the entire `styles: [...]` block with:

```ts
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
```

Also in `examples/ag-ui/angular/src/app/shell/ag-ui-shell.component.css`, update the body border:

Old (line ~205):
```css
.ag-ui-shell__itinerary {
  flex: 0 0 300px;
  min-height: 0;
  overflow-y: auto;
  border-right: 1px solid var(--tp-border, #e5e7eb);
}
```

New:
```css
.ag-ui-shell__itinerary {
  flex: 0 0 300px;
  min-height: 0;
  overflow-y: auto;
  border-right: 1px solid var(--ngaf-chat-separator);
}
```

And update the mobile fallback border in the same file (`@media (max-width: 900px)` block — change `border-bottom: 1px solid var(--tp-border, #e5e7eb)` to `var(--ngaf-chat-separator)`).

- [ ] **Step 2: Smoke check the panel renders**

Run: `pnpm nx serve examples-ag-ui-angular` in one shell, open `http://localhost:4200` in a browser, verify the panel renders and switches color cleanly when the theme toggle flips between light and dark.

If you can't run a browser, run: `pnpm nx build examples-ag-ui-angular --configuration=development`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add examples/ag-ui/angular/src/app/itinerary-panel.component.ts examples/ag-ui/angular/src/app/shell/ag-ui-shell.component.css
git commit -m "style(ag-ui): repaint itinerary panel onto chat library tokens"
```

---

## Task 4: Restructure DOM — day header, per-day add affordance, numbered card row

**Files:**
- Modify: `examples/ag-ui/angular/src/app/itinerary-panel.component.ts`

Now the structural change. Replace the global bottom form with a per-day inline composer. Add a count badge to the panel head. Convert each stop to a numbered card row. Drag handles + remove icons are placeholders in this task (rendered as text); icons come in Task 5; drag wiring comes in Task 6.

- [ ] **Step 1: Update component imports + signals**

Replace the entire `examples/ag-ui/angular/src/app/itinerary-panel.component.ts` with:

```ts
// SPDX-License-Identifier: MIT
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { ItineraryStore } from './itinerary-store';

@Component({
  selector: 'app-itinerary-panel',
  standalone: true,
  imports: [DragDropModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'itin', role: 'region', 'aria-label': 'Trip itinerary' },
  template: `
    <div class="itin__head">
      <h2 class="itin__title">
        Trip itinerary
        <span class="itin__total">· {{ totalLabel() }}</span>
      </h2>
      <button
        type="button"
        class="itin__overflow"
        [attr.aria-expanded]="menuOpen()"
        aria-label="Itinerary actions"
        (click)="toggleMenu()"
      >more_vert</button>
      @if (menuOpen()) {
        <div class="itin__menu" role="menu">
          <button type="button" class="itin__menu-item" role="menuitem" (click)="reset()">
            Reset demo data
          </button>
        </div>
      }
    </div>

    @for (g of store.days(); track g.day) {
      <section class="itin__day">
        <header class="itin__day-head">
          <h3 class="itin__day-title">Day {{ g.day }}</h3>
          <span class="itin__day-count">{{ g.stops.length }} stop{{ g.stops.length === 1 ? '' : 's' }}</span>
          <button
            type="button"
            class="itin__day-add"
            [class.is-active]="composer() === g.day"
            (click)="openComposer(g.day)"
          >add Add stop</button>
        </header>
        <ul class="itin__stops">
          @for (s of g.stops; track s.id; let i = $index) {
            <li class="itin__stop">
              <span class="itin__handle" aria-hidden="true">drag_indicator</span>
              <span class="itin__index">{{ i + 1 }}</span>
              <span class="itin__place">
                <span class="itin__place-name">{{ s.place }}</span>
                @if (s.note) { <span class="itin__note">{{ s.note }}</span> }
              </span>
              <button
                type="button"
                class="itin__remove"
                [attr.aria-label]="'Remove ' + s.place"
                (click)="remove(s.id)"
              >close</button>
            </li>
          }
        </ul>
        @if (composer() === g.day) {
          <form class="itin__composer" (submit)="commitComposer($event, g.day)">
            <input
              class="itin__composer-input"
              type="text"
              placeholder="Add a place"
              [value]="composerText()"
              (input)="composerText.set($any($event.target).value)"
              (blur)="commitComposer($event, g.day)"
              aria-label="Add a place"
              autofocus
            />
          </form>
        }
      </section>
    } @empty {
      <p class="itin__empty">No stops planned yet.</p>
    }

    @if (showFooterAdd()) {
      <button type="button" class="itin__add-day-btn" (click)="addNewDay()">add Add a day</button>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        padding: 16px;
        font-size: var(--ngaf-chat-font-size-sm);
        color: var(--ngaf-chat-text);
        font-family: var(--ngaf-chat-font-family);
        position: relative;
      }
      .itin__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 16px;
        position: relative;
      }
      .itin__title {
        margin: 0;
        font-size: 1rem;
        color: var(--ngaf-chat-text);
        display: flex;
        align-items: baseline;
        gap: 6px;
      }
      .itin__total {
        font-size: 0.8rem;
        color: var(--ngaf-chat-text-muted);
        font-weight: normal;
      }
      .itin__overflow {
        font-family: 'Material Symbols Outlined', sans-serif;
        font-size: 18px;
        background: transparent;
        border: none;
        color: var(--ngaf-chat-text-muted);
        cursor: pointer;
        padding: 4px;
        border-radius: var(--ngaf-chat-radius-card);
        line-height: 1;
      }
      .itin__overflow:hover {
        background: var(--ngaf-chat-surface-alt);
        color: var(--ngaf-chat-text);
      }
      .itin__menu {
        position: absolute;
        top: 100%;
        right: 0;
        background: var(--ngaf-chat-bg);
        border: 1px solid var(--ngaf-chat-separator);
        border-radius: var(--ngaf-chat-radius-card);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        z-index: 10;
        min-width: 160px;
      }
      .itin__menu-item {
        display: block;
        width: 100%;
        text-align: left;
        background: transparent;
        border: none;
        color: var(--ngaf-chat-text);
        padding: 8px 12px;
        cursor: pointer;
        font: inherit;
      }
      .itin__menu-item:hover {
        background: var(--ngaf-chat-surface-alt);
      }
      .itin__day {
        margin-bottom: 14px;
      }
      .itin__day-head {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;
      }
      .itin__day-title {
        margin: 0;
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--ngaf-chat-text);
      }
      .itin__day-count {
        font-size: 0.75rem;
        color: var(--ngaf-chat-text-muted);
      }
      .itin__day-add {
        font-family: inherit;
        font-size: 0.75rem;
        background: transparent;
        border: 1px dashed var(--ngaf-chat-separator);
        color: var(--ngaf-chat-text-muted);
        border-radius: var(--ngaf-chat-radius-card);
        padding: 2px 8px;
        cursor: pointer;
        margin-left: auto;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .itin__day-add:hover, .itin__day-add.is-active {
        color: var(--ngaf-chat-text);
        border-color: var(--ngaf-chat-text);
      }
      .itin__day-add::first-letter {
        font-family: 'Material Symbols Outlined', sans-serif;
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
        gap: 6px;
        padding: 8px 10px;
        border: 1px solid var(--ngaf-chat-separator);
        border-radius: var(--ngaf-chat-radius-card);
        background: var(--ngaf-chat-bg);
        transition: box-shadow 200ms ease, transform 200ms ease;
      }
      .itin__handle {
        font-family: 'Material Symbols Outlined', sans-serif;
        font-size: 16px;
        color: var(--ngaf-chat-text-muted);
        cursor: grab;
        opacity: 0;
        transition: opacity 100ms ease;
        line-height: 1;
        flex: none;
      }
      .itin__stop:hover .itin__handle { opacity: 1; }
      .itin__index {
        flex: none;
        width: 22px;
        height: 22px;
        border-radius: 6px;
        background: var(--ngaf-chat-text);
        color: var(--ngaf-chat-bg);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 0.7rem;
        font-weight: 600;
      }
      .itin__place {
        flex: 1 1 auto;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 1px;
      }
      .itin__place-name {
        color: var(--ngaf-chat-text);
        font-weight: 500;
      }
      .itin__note {
        color: var(--ngaf-chat-text-muted);
        font-size: 0.8rem;
      }
      .itin__remove {
        flex: none;
        font-family: 'Material Symbols Outlined', sans-serif;
        font-size: 16px;
        background: transparent;
        border: none;
        color: var(--ngaf-chat-text-muted);
        cursor: pointer;
        padding: 4px;
        line-height: 1;
        opacity: 0;
        transition: opacity 100ms ease;
        border-radius: 4px;
      }
      .itin__stop:hover .itin__remove { opacity: 0.7; }
      .itin__remove:hover { opacity: 1 !important; color: var(--ngaf-chat-text); }
      .itin__composer {
        margin-top: 6px;
      }
      .itin__composer-input {
        width: 100%;
        padding: 8px 10px;
        border: 1px solid var(--ngaf-chat-text);
        border-radius: var(--ngaf-chat-radius-card);
        background: var(--ngaf-chat-bg);
        color: var(--ngaf-chat-text);
        font-family: inherit;
        font-size: inherit;
        box-sizing: border-box;
      }
      .itin__add-day-btn {
        margin-top: 12px;
        font-family: inherit;
        font-size: 0.8rem;
        background: transparent;
        border: 1px dashed var(--ngaf-chat-separator);
        color: var(--ngaf-chat-text-muted);
        border-radius: var(--ngaf-chat-radius-card);
        padding: 6px 12px;
        cursor: pointer;
        width: 100%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
      }
      .itin__add-day-btn:hover {
        color: var(--ngaf-chat-text);
        border-color: var(--ngaf-chat-text);
      }
      .itin__empty {
        color: var(--ngaf-chat-text-muted);
        margin: 8px 0;
      }
    `,
  ],
})
export class ItineraryPanelComponent {
  protected readonly store = inject(ItineraryStore);
  protected readonly menuOpen = signal(false);
  protected readonly composer = signal<number | null>(null);
  protected readonly composerText = signal('');
  protected readonly totalLabel = computed(() => {
    const n = this.store.stops().length;
    return `${n} stop${n === 1 ? '' : 's'}`;
  });
  protected readonly showFooterAdd = computed(() => this.store.days().length > 0);

  protected toggleMenu(): void {
    this.menuOpen.update((v) => !v);
  }

  protected reset(): void {
    this.store.reset({ source: 'user' });
    this.menuOpen.set(false);
  }

  protected openComposer(day: number): void {
    this.composer.set(day);
    this.composerText.set('');
  }

  protected commitComposer(event: Event, day: number): void {
    event.preventDefault();
    const text = this.composerText().trim();
    if (text) {
      this.store.add(day, text, undefined, { source: 'user' });
    }
    this.composer.set(null);
    this.composerText.set('');
  }

  protected addNewDay(): void {
    const maxDay = Math.max(0, ...this.store.days().map((g) => g.day));
    this.openComposer(maxDay + 1);
  }

  protected remove(id: string): void {
    this.store.remove(id, { source: 'user' });
  }
}
```

- [ ] **Step 2: Run the existing e2e to verify the panel still works**

Run: `pnpm nx e2e examples-ag-ui-angular --testFile=itinerary-client-tools.spec.ts --grep "panel renders the seeded itinerary"`
Expected: PASS — the "Louvre / Eiffel Tower / Musée d'Orsay" assertion still holds.

If e2e infra isn't easily runnable, fall back to: `pnpm nx build examples-ag-ui-angular --configuration=development` (passes), and visually verify with `pnpm nx serve examples-ag-ui-angular`.

- [ ] **Step 3: Commit**

```bash
git add examples/ag-ui/angular/src/app/itinerary-panel.component.ts
git commit -m "feat(ag-ui): restructure itinerary panel with day headers, per-day add, numbered cards"
```

---

## Task 5: Replace text placeholders with Material Symbols icons

**Files:**
- Modify: `examples/ag-ui/angular/src/app/itinerary-panel.component.ts` (template only)
- Verify: `examples/ag-ui/angular/src/index.html` already loads the Material Symbols font

Task 4 used literal text (`drag_indicator`, `close`, `add`, `more_vert`) inside elements whose `font-family` is `'Material Symbols Outlined'`. The font ligature renders those as glyphs automatically. This task verifies the font is loaded and tidies the `add` icon usage (which Task 4 hacked via `::first-letter` for the day-add button).

- [ ] **Step 1: Verify the font is loaded**

Run: `grep -n "Material Symbols" examples/ag-ui/angular/src/index.html examples/ag-ui/angular/src/styles.css`
Expected: at least one match in `index.html` (a `<link>` to the Google Fonts URL) or `styles.css` (an `@import`). If absent, add to `index.html` inside `<head>`:

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" />
```

- [ ] **Step 2: Clean up the day-add button to use a proper span for the icon**

In `examples/ag-ui/angular/src/app/itinerary-panel.component.ts`, replace the day-add button markup:

Old:
```html
<button
  type="button"
  class="itin__day-add"
  [class.is-active]="composer() === g.day"
  (click)="openComposer(g.day)"
>add Add stop</button>
```

New:
```html
<button
  type="button"
  class="itin__day-add"
  [class.is-active]="composer() === g.day"
  (click)="openComposer(g.day)"
>
  <span class="itin__icon" aria-hidden="true">add</span>
  <span>Add stop</span>
</button>
```

Replace the `Add a day` button markup similarly:

```html
<button type="button" class="itin__add-day-btn" (click)="addNewDay()">
  <span class="itin__icon" aria-hidden="true">add</span>
  <span>Add a day</span>
</button>
```

Remove the `::first-letter` rule from `.itin__day-add`, and add a new `.itin__icon` rule to the `styles:` array:

```css
.itin__icon {
  font-family: 'Material Symbols Outlined', sans-serif;
  font-size: 16px;
  line-height: 1;
  vertical-align: -3px;
}
```

- [ ] **Step 3: Smoke-test the visual**

Run: `pnpm nx serve examples-ag-ui-angular` and confirm icons render as glyphs (not as the literal words `drag_indicator`, `close`, `add`, `more_vert`).

If a glyph appears as a word, the font is not loading — check the `<link>` URL and browser network tab.

- [ ] **Step 4: Commit**

```bash
git add examples/ag-ui/angular/src/app/itinerary-panel.component.ts examples/ag-ui/angular/src/index.html
git commit -m "feat(ag-ui): use Material Symbols ligatures for panel icons"
```

---

## Task 6: Wire CDK drag-to-reorder (within day + across days)

**Files:**
- Modify: `examples/ag-ui/angular/src/app/itinerary-panel.component.ts`

Add `cdkDropListGroup` on the panel host, `cdkDropList` per day section, `cdkDrag` per row with `cdkDragHandle` on the drag-indicator icon. Drop handler calls `store.reorder(...)` with `source: 'user'`.

- [ ] **Step 1: Update template + class with drag bindings**

In the template, wrap the day sections with `cdkDropListGroup` and per-day `cdkDropList`:

Replace the `@for (g of store.days(); …) { <section class="itin__day"> … </section> }` block with:

```html
<div cdkDropListGroup>
  @for (g of store.days(); track g.day) {
    <section class="itin__day">
      <header class="itin__day-head">
        <h3 class="itin__day-title">Day {{ g.day }}</h3>
        <span class="itin__day-count">{{ g.stops.length }} stop{{ g.stops.length === 1 ? '' : 's' }}</span>
        <button
          type="button"
          class="itin__day-add"
          [class.is-active]="composer() === g.day"
          (click)="openComposer(g.day)"
        >
          <span class="itin__icon" aria-hidden="true">add</span>
          <span>Add stop</span>
        </button>
      </header>
      <ul
        class="itin__stops"
        cdkDropList
        [cdkDropListData]="g.stops"
        [id]="'itin-day-' + g.day"
        (cdkDropListDropped)="onDrop($event, g.day)"
      >
        @for (s of g.stops; track s.id; let i = $index) {
          <li class="itin__stop" cdkDrag [cdkDragData]="s">
            <span class="itin__handle" cdkDragHandle aria-hidden="true">drag_indicator</span>
            <span class="itin__index">{{ i + 1 }}</span>
            <span class="itin__place">
              <span class="itin__place-name">{{ s.place }}</span>
              @if (s.note) { <span class="itin__note">{{ s.note }}</span> }
            </span>
            <button
              type="button"
              class="itin__remove"
              [attr.aria-label]="'Remove ' + s.place"
              (click)="remove(s.id)"
            >close</button>
          </li>
        }
      </ul>
      @if (composer() === g.day) {
        <form class="itin__composer" (submit)="commitComposer($event, g.day)">
          <input
            class="itin__composer-input"
            type="text"
            placeholder="Add a place"
            [value]="composerText()"
            (input)="composerText.set($any($event.target).value)"
            (blur)="commitComposer($event, g.day)"
            aria-label="Add a place"
            autofocus
          />
        </form>
      }
    </section>
  } @empty {
    <p class="itin__empty">No stops planned yet.</p>
  }
</div>
```

Add the import for `CdkDragDrop` at the top of the file:

```ts
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
```

Replace the `import { ItineraryStore } …` line with:

```ts
import { ItineraryStop, ItineraryStore } from './itinerary-store';
```

Add the `onDrop` method to the class:

```ts
protected onDrop(event: CdkDragDrop<ItineraryStop[]>, toDay: number): void {
  const stop = event.item.data as ItineraryStop;
  this.store.reorder(stop.id, toDay, event.currentIndex, { source: 'user' });
}
```

Add CSS to the `styles:` array for CDK drag visuals:

```css
.itin__stop.cdk-drag-preview {
  box-shadow:
    0 5px 5px -3px rgba(0, 0, 0, 0.2),
    0 8px 10px 1px rgba(0, 0, 0, 0.14),
    0 3px 14px 2px rgba(0, 0, 0, 0.12);
  background: var(--ngaf-chat-bg);
}
.itin__stop.cdk-drag-placeholder {
  opacity: 0.3;
}
.itin__stops.cdk-drop-list-dragging .itin__stop:not(.cdk-drag-placeholder) {
  transition: transform 200ms cubic-bezier(0, 0, 0.2, 1);
}
```

- [ ] **Step 2: Manual smoke**

Run: `pnpm nx serve examples-ag-ui-angular` and try dragging stops within a day and across days. Verify the panel reorders persistently (reload still shows the new order) and the agent-edit pulse does NOT fire (because the drop uses `source: 'user'`).

- [ ] **Step 3: Write an e2e for drag (skipped under CI by default)**

Append to `examples/ag-ui/angular/e2e/itinerary-client-tools.spec.ts`:

```ts
test('user can drag-reorder stops within a day', async ({ page }) => {
  await openDemo(page);

  const panel = page.getByRole('region', { name: 'Trip itinerary' });
  const eiffel = panel.getByText('Eiffel Tower');
  const louvre = panel.getByText('Louvre');

  // Drag Eiffel above Louvre — drop on the Louvre row.
  await eiffel.hover();
  await page.mouse.down();
  await louvre.hover();
  await page.mouse.up();

  // First text-content match in the day-1 list should now be Eiffel.
  const day1Stops = panel.locator('[id="itin-day-1"] .itin__place-name');
  await expect(day1Stops.first()).toHaveText('Eiffel Tower');
});
```

Run: `pnpm nx e2e examples-ag-ui-angular --grep "user can drag-reorder"`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add examples/ag-ui/angular/src/app/itinerary-panel.component.ts examples/ag-ui/angular/e2e/itinerary-client-tools.spec.ts
git commit -m "feat(ag-ui): CDK drag-to-reorder for itinerary stops"
```

---

## Task 7: Agent-edit pulse — CSS + signal-driven class

**Files:**
- Modify: `examples/ag-ui/angular/src/app/itinerary-panel.component.ts`

Add a `.itin__stop--pulse` class with a 1.6s animation. The panel reads `store.recentlyChangedId()` and applies the class to the matching row.

- [ ] **Step 1: Write the failing unit test for the panel's pulse class binding**

This requires a component test. Add a new file `examples/ag-ui/angular/src/app/itinerary-panel.component.spec.ts`:

```ts
// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ItineraryPanelComponent } from './itinerary-panel.component';
import { ItineraryStore } from './itinerary-store';

describe('ItineraryPanelComponent — agent-edit pulse', () => {
  beforeEach(() => localStorage.clear());

  it('applies .itin__stop--pulse to the row matching recentlyChangedId', async () => {
    TestBed.configureTestingModule({
      providers: [ItineraryStore],
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
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm nx test examples-ag-ui-angular --testFile=itinerary-panel.component.spec.ts`
Expected: FAIL — no `--pulse` class applied.

- [ ] **Step 3: Wire the class binding + animation**

In `examples/ag-ui/angular/src/app/itinerary-panel.component.ts`:

Update the `<li>` stop row to add the pulse class:

```html
<li
  class="itin__stop"
  [class.itin__stop--pulse]="store.recentlyChangedId() === s.id"
  cdkDrag
  [cdkDragData]="s"
>
```

Add to the `styles:` array:

```css
@keyframes itinPulse {
  0%   { box-shadow: 0 0 0 0 var(--ngaf-chat-primary); transform: scale(1); }
  20%  { box-shadow: 0 0 0 3px color-mix(in srgb, var(--ngaf-chat-primary) 50%, transparent); transform: scale(1.015); }
  100% { box-shadow: 0 0 0 0 transparent; transform: scale(1); }
}
.itin__stop--pulse {
  animation: itinPulse 1600ms ease-out;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm nx test examples-ag-ui-angular --testFile=itinerary-panel.component.spec.ts`
Expected: PASS.

- [ ] **Step 5: Manual smoke**

Run: `pnpm nx serve examples-ag-ui-angular`, ask the agent "Add the Eiffel Tower to Day 2". Confirm the newly-added row briefly pulses with a primary-color ring.

- [ ] **Step 6: Commit**

```bash
git add examples/ag-ui/angular/src/app/itinerary-panel.component.ts examples/ag-ui/angular/src/app/itinerary-panel.component.spec.ts
git commit -m "feat(ag-ui): agent-edit pulse on the just-changed itinerary row"
```

---

## Task 8: Polished empty state — luggage icon + suggestion chips

**Files:**
- Modify: `examples/ag-ui/angular/src/app/itinerary-panel.component.ts`

Replace the dimmed `<p>No stops planned yet.</p>` with a styled empty state: a `luggage` glyph, headline, and two suggestion chips that send pre-typed prompts to the agent.

- [ ] **Step 1: Inject the agent + add suggestion handler**

In `examples/ag-ui/angular/src/app/itinerary-panel.component.ts`, update imports and class:

```ts
import { injectAgent } from '@threadplane/ag-ui';
import { ITINERARY_AGENT } from './client-tools';
```

In the class body, add:

```ts
private readonly agent = injectAgent(ITINERARY_AGENT);

protected suggestion(prompt: string): void {
  void this.agent.submit({ message: prompt });
}
```

- [ ] **Step 2: Replace the empty state markup**

Replace the `@empty { <p class="itin__empty">No stops planned yet.</p> }` block with:

```html
@empty {
  <div class="itin__empty" role="status">
    <span class="itin__empty-icon" aria-hidden="true">luggage</span>
    <p class="itin__empty-title">Your trip is empty</p>
    <p class="itin__empty-sub">Ask the agent to plan something, or add a stop yourself.</p>
    <div class="itin__empty-chips">
      <button
        type="button"
        class="itin__empty-chip"
        (click)="suggestion('Plan a Paris weekend')"
      >Plan a Paris weekend</button>
      <button
        type="button"
        class="itin__empty-chip"
        (click)="suggestion('Add a Day 1 stop')"
      >Add a Day 1 stop</button>
    </div>
  </div>
}
```

Replace the empty-state CSS in the `styles:` array (delete the old `.itin__empty` rule and add):

```css
.itin__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8px;
  padding: 24px 8px;
  color: var(--ngaf-chat-text-muted);
}
.itin__empty-icon {
  font-family: 'Material Symbols Outlined', sans-serif;
  font-size: 48px;
  color: var(--ngaf-chat-text-muted);
  line-height: 1;
}
.itin__empty-title {
  margin: 0;
  font-size: 0.95rem;
  color: var(--ngaf-chat-text);
  font-weight: 500;
}
.itin__empty-sub {
  margin: 0;
  font-size: 0.8rem;
}
.itin__empty-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
  margin-top: 4px;
}
.itin__empty-chip {
  font-family: inherit;
  font-size: 0.8rem;
  background: transparent;
  border: 1px solid var(--ngaf-chat-separator);
  color: var(--ngaf-chat-text);
  border-radius: 999px;
  padding: 4px 12px;
  cursor: pointer;
}
.itin__empty-chip:hover {
  background: var(--ngaf-chat-surface-alt);
  border-color: var(--ngaf-chat-text);
}
```

- [ ] **Step 3: Manual smoke**

Run: `pnpm nx serve examples-ag-ui-angular`, click "Reset demo data" from the overflow menu twice in a row, then clear stops one by one until empty. Verify the empty state renders with the luggage glyph and chips. Click a chip and verify the agent receives the prompt.

- [ ] **Step 4: Commit**

```bash
git add examples/ag-ui/angular/src/app/itinerary-panel.component.ts
git commit -m "feat(ag-ui): polished empty state with suggestion chips"
```

---

## Task 9: Add `reorder_stop` client tool; `move_stop` becomes sugar

**Files:**
- Modify: `examples/ag-ui/angular/src/app/client-tools.ts`

A new agent-callable action mirrors the user's drag-reorder capability. `move_stop` becomes a thin wrapper over `reorder` (appends to the end of the target day).

- [ ] **Step 1: Update `client-tools.ts`**

In `examples/ag-ui/angular/src/app/client-tools.ts`, replace the `move_stop` tool body and append a new `reorder_stop`:

```ts
move_stop: action(
  'Move an existing stop (matched by place name) to another day. Afterwards, show the updated day with day_card.',
  z.object({ place: z.string(), toDay: z.number().int().min(1) }),
  async ({ place, toDay }) => {
    const target = store.stops().find((s) => s.place.toLowerCase() === place.toLowerCase());
    if (!target) {
      return { error: `No stop named "${place}" — call get_itinerary to see what exists.` };
    }
    const toDayStops = store.stops().filter((s) => s.day === toDay && s.id !== target.id);
    store.reorder(target.id, toDay, toDayStops.length);
    return { moved: { ...target, day: toDay } };
  },
),
reorder_stop: action(
  'Reorder a stop within or across days. Use after the user describes a sequence change (e.g., "put Louvre first", "move Eiffel to day 2 second"). `toIndex` is zero-based within the target day.',
  z.object({
    place: z.string(),
    toDay: z.number().int().min(1),
    toIndex: z.number().int().min(0),
  }),
  async ({ place, toDay, toIndex }) => {
    const target = store.stops().find((s) => s.place.toLowerCase() === place.toLowerCase());
    if (!target) {
      return { error: `No stop named "${place}" — call get_itinerary to see what exists.` };
    }
    store.reorder(target.id, toDay, toIndex);
    return { reordered: { ...target, day: toDay, toIndex } };
  },
),
```

- [ ] **Step 2: Build to verify types**

Run: `pnpm nx build examples-ag-ui-angular --configuration=development`
Expected: PASS.

- [ ] **Step 3: Extend the e2e to exercise `reorder_stop`**

Append to `examples/ag-ui/angular/e2e/itinerary-client-tools.spec.ts`:

```ts
test('reorder_stop: agent puts Louvre last on day 1', async ({ page }) => {
  await openDemo(page);
  const hygiene = attachBrowserHygiene(page);

  await messageInput(page).fill('Put Louvre last on day 1.');
  await sendButton(page).click();

  const day1Stops = page
    .getByRole('region', { name: 'Trip itinerary' })
    .locator('[id="itin-day-1"] .itin__place-name');
  await expect(day1Stops.last()).toHaveText('Louvre', { timeout: 30_000 });

  expect(hygiene.consoleErrors).toEqual([]);
});
```

Run: `pnpm nx e2e examples-ag-ui-angular --grep "reorder_stop"`
Expected: PASS (live LLM required).

- [ ] **Step 4: Commit**

```bash
git add examples/ag-ui/angular/src/app/client-tools.ts examples/ag-ui/angular/e2e/itinerary-client-tools.spec.ts
git commit -m "feat(ag-ui): add reorder_stop client tool; move_stop now wraps reorder"
```

---

## Task 10: Verify Phase 1 is shippable

**Files:** none — verification only.

- [ ] **Step 1: Lint + typecheck**

Run: `pnpm nx lint examples-ag-ui-angular` and `pnpm tsc --noEmit -p examples/ag-ui/angular/tsconfig.app.json`
Expected: both green.

- [ ] **Step 2: Full unit-test suite for the project**

Run: `pnpm nx test examples-ag-ui-angular`
Expected: all green.

- [ ] **Step 3: Build in production mode**

Run: `pnpm nx build examples-ag-ui-angular --configuration=production`
Expected: PASS — bundle stays under the 1.5MB initial-bundle error budget. CDK adds ~25KB gzipped to the drag-drop entry, well within budget.

- [ ] **Step 4: Manual smoke against the live AG-UI runtime**

Per the project's live-LLM smoke gate: run the example with a real OpenAI key via the AG-UI server, manually exercise:
- Reset → seed renders with numbered cards
- Drag Eiffel above Louvre (within-day reorder, no pulse)
- Drag Orsay from Day 2 to Day 1 (cross-day, no pulse)
- "Add the Pantheon to Day 1" via chat (pulse fires on the new row)
- "Move Eiffel to Day 3" via chat (pulse fires)
- Clear all stops, verify empty state, click "Plan a Paris weekend" chip

- [ ] **Step 5: Open the PR**

```bash
git push origin HEAD
gh pr create --title "feat(ag-ui): productize itinerary panel (phase 1)" --body "$(cat <<'EOF'
## Summary
- Repaint itinerary panel onto `--ngaf-chat-*` tokens; Material Symbols icons
- New numbered card rows; per-day add affordance replaces the global form
- CDK drag-to-reorder within and across days
- Agent-edit pulse animation on rows changed by client tools
- Polished empty state with suggestion chips
- New `reorder_stop` client tool; `move_stop` now wraps `reorder`

Implements Phase 1 of [docs/superpowers/specs/2026-06-22-ag-ui-itinerary-redesign-design.md](docs/superpowers/specs/2026-06-22-ag-ui-itinerary-redesign-design.md). Phase 2 (App mode + Google Map) follows after this merges.

## Test plan
- [x] Unit suite green (`pnpm nx test examples-ag-ui-angular`)
- [x] E2E with live LLM green (`pnpm nx e2e examples-ag-ui-angular`)
- [x] Production build under bundle budget
- [x] Manual smoke against live AG-UI runtime

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review Checklist (for the implementer)

Before opening the PR, re-read the spec ([2026-06-22-ag-ui-itinerary-redesign-design.md](../specs/2026-06-22-ag-ui-itinerary-redesign-design.md) §1.1–1.8) and confirm:

- [ ] Every chat token swapped (`--tp-border` and `--a2ui-primary` no longer appear in `examples/ag-ui/angular/` — grep to verify)
- [ ] Material Symbols glyphs render (not the literal words)
- [ ] Drag works mouse + keyboard (CDK gives keyboard for free; test by focusing a row, pressing space, then arrow keys)
- [ ] Pulse fires on agent edits and NOT on user edits
- [ ] Empty state chips submit the agent
- [ ] `reorder_stop` is reachable by the model (describe its purpose clearly so the model picks it)
- [ ] `move_stop` still functions for "move Eiffel to Day 2" (regression check)
