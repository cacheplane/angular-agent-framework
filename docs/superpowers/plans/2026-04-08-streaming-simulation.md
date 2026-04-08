# Streaming Simulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace static spec cycling in all 6 render examples with a streaming simulation using the real partial JSON parser, timeline scrubber, and progressive rendering.

**Architecture:** A shared `StreamingSimulator` class wraps `createPartialJsonParser()` + `materialize()` from `@cacheplane/partial-json`. It feeds a pre-stringified JSON spec character-by-character via `requestAnimationFrame`, exposing Angular signals for the partial spec, raw JSON, position, and playback state. A shared `StreamingTimelineComponent` renders the play/pause, scrubber, and speed controls. Each of the 6 render examples uses these shared utilities with feature-specific specs.

**Tech Stack:** Angular 19 (standalone components, signals), `@cacheplane/partial-json`, `@cacheplane/render`, `@json-render/core`, Vitest

---

## Task 1: StreamingSimulator Class

**Files:**
- Create: `cockpit/render/shared/streaming-simulator.ts`
- Create: `cockpit/render/shared/streaming-simulator.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// cockpit/render/shared/streaming-simulator.spec.ts
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { StreamingSimulator } from './streaming-simulator';

const SIMPLE_SPEC = JSON.stringify({
  root: 'root',
  elements: {
    root: { type: 'Text', props: { content: 'Hello' } },
  },
});

describe('StreamingSimulator', () => {
  let simulator: StreamingSimulator;

  beforeEach(() => {
    simulator = new StreamingSimulator(SIMPLE_SPEC);
  });

  afterEach(() => {
    simulator.destroy();
  });

  it('initializes with position 0 and total equal to source length', () => {
    expect(simulator.position()).toBe(0);
    expect(simulator.total()).toBe(SIMPLE_SPEC.length);
    expect(simulator.playing()).toBe(false);
    expect(simulator.speed()).toBe(1);
    expect(simulator.spec()).toBeNull();
    expect(simulator.rawJson()).toBe('');
  });

  it('seek parses from 0 to the given position and materializes', () => {
    simulator.seek(SIMPLE_SPEC.length);
    expect(simulator.position()).toBe(SIMPLE_SPEC.length);
    expect(simulator.spec()).not.toBeNull();
    expect(simulator.spec()?.root).toBe('root');
    expect(simulator.rawJson()).toBe(SIMPLE_SPEC);
  });

  it('seek to partial position produces partial spec', () => {
    // Seek to just past {"root": — enough for the root key
    const partialPos = 10;
    simulator.seek(partialPos);
    expect(simulator.position()).toBe(partialPos);
    expect(simulator.rawJson()).toBe(SIMPLE_SPEC.slice(0, partialPos));
  });

  it('seek backwards re-parses from 0', () => {
    simulator.seek(SIMPLE_SPEC.length);
    simulator.seek(5);
    expect(simulator.position()).toBe(5);
    expect(simulator.rawJson()).toBe(SIMPLE_SPEC.slice(0, 5));
  });

  it('setSource resets to new source', () => {
    const newSpec = JSON.stringify({ root: 'r', elements: {} });
    simulator.setSource(newSpec);
    expect(simulator.total()).toBe(newSpec.length);
    expect(simulator.position()).toBe(0);
    expect(simulator.spec()).toBeNull();
  });

  it('toggle switches playing state', () => {
    expect(simulator.playing()).toBe(false);
    simulator.toggle();
    expect(simulator.playing()).toBe(true);
    simulator.toggle();
    expect(simulator.playing()).toBe(false);
  });

  it('setSpeed updates speed', () => {
    simulator.setSpeed(4);
    expect(simulator.speed()).toBe(4);
  });

  it('progress returns fraction', () => {
    expect(simulator.progress()).toBe(0);
    simulator.seek(SIMPLE_SPEC.length);
    expect(simulator.progress()).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PATH="/Users/blove/.nvm/versions/node/v22.14.0/bin:$PATH" npx vitest run cockpit/render/shared/streaming-simulator.spec.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// cockpit/render/shared/streaming-simulator.ts
import { signal, computed } from '@angular/core';
import { createPartialJsonParser, materialize } from '@cacheplane/partial-json';
import type { PartialJsonParser, ParseEvent } from '@cacheplane/partial-json';
import type { Spec } from '@json-render/core';

export class StreamingSimulator {
  private source: string;
  private parser: PartialJsonParser;
  private animFrameId: number | null = null;

  readonly position = signal(0);
  readonly total = signal(0);
  readonly playing = signal(false);
  readonly speed = signal(1);
  readonly spec = signal<Spec | null>(null);
  readonly rawJson = signal('');
  readonly events = signal<ParseEvent[]>([]);

  readonly progress = computed(() => {
    const t = this.total();
    return t === 0 ? 0 : this.position() / t;
  });

  constructor(source: string) {
    this.source = source;
    this.parser = createPartialJsonParser();
    this.total.set(source.length);
  }

  play(): void {
    if (this.playing()) return;
    this.playing.set(true);
    this.tick();
  }

  pause(): void {
    this.playing.set(false);
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  toggle(): void {
    if (this.playing()) {
      this.pause();
    } else {
      // If at end, restart
      if (this.position() >= this.total()) {
        this.seek(0);
      }
      this.play();
    }
  }

  seek(pos: number): void {
    const clamped = Math.max(0, Math.min(pos, this.source.length));
    // Re-parse from scratch
    this.parser = createPartialJsonParser();
    const chunk = this.source.slice(0, clamped);
    const allEvents = chunk.length > 0 ? this.parser.push(chunk) : [];
    this.position.set(clamped);
    this.rawJson.set(chunk);
    this.events.set(allEvents);
    this.spec.set(
      this.parser.root ? (materialize(this.parser.root) as Spec | null) : null
    );
  }

  setSpeed(multiplier: number): void {
    this.speed.set(multiplier);
  }

  setSource(json: string): void {
    this.pause();
    this.source = json;
    this.parser = createPartialJsonParser();
    this.total.set(json.length);
    this.position.set(0);
    this.rawJson.set('');
    this.spec.set(null);
    this.events.set([]);
  }

  destroy(): void {
    this.pause();
  }

  private tick(): void {
    if (!this.playing()) return;
    const currentPos = this.position();
    const spd = this.speed();
    const nextPos = Math.min(currentPos + spd, this.source.length);

    if (nextPos > currentPos) {
      const chunk = this.source.slice(currentPos, nextPos);
      const newEvents = this.parser.push(chunk);
      this.position.set(nextPos);
      this.rawJson.set(this.source.slice(0, nextPos));
      this.events.update((prev) => [...prev, ...newEvents]);
      this.spec.set(
        this.parser.root ? (materialize(this.parser.root) as Spec | null) : null
      );
    }

    if (nextPos >= this.source.length) {
      this.pause();
      return;
    }

    this.animFrameId = requestAnimationFrame(() => this.tick());
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `PATH="/Users/blove/.nvm/versions/node/v22.14.0/bin:$PATH" npx vitest run cockpit/render/shared/streaming-simulator.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add cockpit/render/shared/streaming-simulator.ts cockpit/render/shared/streaming-simulator.spec.ts
git commit -m "feat(cockpit): add StreamingSimulator class for render examples"
```

---

## Task 2: StreamingTimelineComponent

**Files:**
- Create: `cockpit/render/shared/streaming-timeline.component.ts`

- [ ] **Step 1: Create the timeline component**

```typescript
// cockpit/render/shared/streaming-timeline.component.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, input, ElementRef, viewChild } from '@angular/core';
import { StreamingSimulator } from './streaming-simulator';

@Component({
  selector: 'streaming-timeline',
  standalone: true,
  template: `
    <div class="flex items-center gap-3 bg-gray-900 rounded-lg px-4 py-3">
      <!-- Play/Pause -->
      <button
        class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors"
        [class]="simulator().playing() ? 'bg-indigo-500 hover:bg-indigo-400' : 'bg-indigo-500 hover:bg-indigo-400'"
        (click)="simulator().toggle()">
        @if (simulator().playing()) {
          <svg width="14" height="14" viewBox="0 0 14 14" fill="white">
            <rect x="3" y="2" width="3" height="10" rx="1"/>
            <rect x="8" y="2" width="3" height="10" rx="1"/>
          </svg>
        } @else {
          <svg width="14" height="14" viewBox="0 0 14 14" fill="white">
            <polygon points="4,2 12,7 4,12"/>
          </svg>
        }
      </button>

      <!-- Scrubber track -->
      <div
        #track
        class="flex-1 relative h-1.5 bg-gray-800 rounded-full cursor-pointer"
        (mousedown)="onTrackMouseDown($event)"
        (touchstart)="onTrackTouchStart($event)">
        <!-- Progress fill -->
        <div
          class="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400"
          [style.width.%]="simulator().progress() * 100">
        </div>
        <!-- Handle -->
        <div
          class="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full border-2 border-indigo-500 shadow-lg shadow-indigo-500/30 -translate-x-1/2"
          [style.left.%]="simulator().progress() * 100">
        </div>
      </div>

      <!-- Character counter -->
      <div class="text-xs text-gray-400 tabular-nums shrink-0 min-w-[100px] text-right">
        <span class="text-gray-200 font-semibold">{{ simulator().position() }}</span>
        / {{ simulator().total() }} chars
      </div>

      <!-- Speed controls -->
      <div class="flex gap-1 shrink-0">
        @for (s of speeds; track s) {
          <button
            class="text-[10px] px-2.5 py-1 rounded transition-colors"
            [class]="simulator().speed() === s ? 'text-indigo-400 bg-indigo-950 font-semibold' : 'text-gray-400 bg-gray-800 hover:text-gray-300'"
            (click)="simulator().setSpeed(s)">
            {{ s }}x
          </button>
        }
      </div>
    </div>
  `,
})
export class StreamingTimelineComponent {
  readonly simulator = input.required<StreamingSimulator>();
  readonly track = viewChild<ElementRef<HTMLElement>>('track');

  protected readonly speeds = [1, 2, 4];

  private dragging = false;

  protected onTrackMouseDown(event: MouseEvent): void {
    event.preventDefault();
    this.dragging = true;
    this.seekFromEvent(event);

    const onMove = (e: MouseEvent) => {
      if (this.dragging) this.seekFromEvent(e);
    };
    const onUp = () => {
      this.dragging = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  protected onTrackTouchStart(event: TouchEvent): void {
    event.preventDefault();
    this.seekFromTouch(event);

    const onMove = (e: TouchEvent) => this.seekFromTouch(e);
    const onEnd = () => {
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    };
    document.addEventListener('touchmove', onMove);
    document.addEventListener('touchend', onEnd);
  }

  private seekFromEvent(event: MouseEvent): void {
    const el = this.track()?.nativeElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    this.simulator().seek(Math.round(fraction * this.simulator().total()));
  }

  private seekFromTouch(event: TouchEvent): void {
    const el = this.track()?.nativeElement;
    if (!el || !event.touches[0]) return;
    const rect = el.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (event.touches[0].clientX - rect.left) / rect.width));
    this.simulator().seek(Math.round(fraction * this.simulator().total()));
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add cockpit/render/shared/streaming-timeline.component.ts
git commit -m "feat(cockpit): add StreamingTimelineComponent for render examples"
```

---

## Task 3: Rewrite spec-rendering Example

**Files:**
- Create: `cockpit/render/spec-rendering/angular/src/app/specs.ts`
- Modify: `cockpit/render/spec-rendering/angular/src/app/spec-rendering.component.ts`

- [ ] **Step 1: Create specs data file**

```typescript
// cockpit/render/spec-rendering/angular/src/app/specs.ts
export interface DemoSpec {
  label: string;
  json: string;
}

export const SPEC_RENDERING_SPECS: DemoSpec[] = [
  {
    label: 'Heading + Text',
    json: JSON.stringify({
      root: 'root',
      elements: {
        root: {
          type: 'Heading',
          props: { content: 'Welcome to Spec Rendering' },
          children: ['desc'],
        },
        desc: {
          type: 'Text',
          props: { content: 'This UI is rendered entirely from a JSON specification. Each element maps to a registered Angular component.' },
        },
      },
    }, null, 2),
  },
  {
    label: 'Card + Badge',
    json: JSON.stringify({
      root: 'root',
      elements: {
        root: {
          type: 'Card',
          props: { title: 'Streaming Demo' },
          children: ['badge', 'info'],
        },
        badge: {
          type: 'Badge',
          props: { label: 'Live Preview' },
        },
        info: {
          type: 'Text',
          props: { content: 'Badges, headings, and text components are all resolved from the registry at runtime.' },
        },
      },
    }, null, 2),
  },
  {
    label: 'Nested Layout',
    json: JSON.stringify({
      root: 'root',
      elements: {
        root: {
          type: 'Heading',
          props: { content: 'Multi-Level Nesting' },
          children: ['section1', 'section2'],
        },
        section1: {
          type: 'Card',
          props: { title: 'Section One' },
          children: ['s1text'],
        },
        s1text: {
          type: 'Text',
          props: { content: 'First section with a card wrapper and nested text content inside.' },
        },
        section2: {
          type: 'Card',
          props: { title: 'Section Two' },
          children: ['s2text'],
        },
        s2text: {
          type: 'Text',
          props: { content: 'Second section demonstrating that the parser handles multiple sibling branches.' },
        },
      },
    }, null, 2),
  },
];
```

- [ ] **Step 2: Rewrite spec-rendering component**

```typescript
// cockpit/render/spec-rendering/angular/src/app/spec-rendering.component.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, input, OnDestroy } from '@angular/core';
import {
  RenderSpecComponent,
  defineAngularRegistry,
  signalStateStore,
} from '@cacheplane/render';
import type { Spec } from '@json-render/core';
import { StreamingSimulator } from '../../../../shared/streaming-simulator';
import { StreamingTimelineComponent } from '../../../../shared/streaming-timeline.component';
import { SPEC_RENDERING_SPECS } from './specs';

// --- Inline view components registered in the demo registry ---

@Component({
  selector: 'demo-text',
  standalone: true,
  template: `<p class="text-gray-100 text-sm">{{ content() }}</p>`,
})
class DemoTextComponent {
  readonly content = input('');
  readonly childKeys = input<string[]>([]);
  readonly spec = input<Spec | null>(null);
}

@Component({
  selector: 'demo-heading',
  standalone: true,
  template: `<h2 class="text-xl font-bold text-gray-50 mb-2">{{ content() }}</h2>`,
})
class DemoHeadingComponent {
  readonly content = input('');
  readonly childKeys = input<string[]>([]);
  readonly spec = input<Spec | null>(null);
}

@Component({
  selector: 'demo-badge',
  standalone: true,
  template: `<span class="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">{{ label() }}</span>`,
})
class DemoBadgeComponent {
  readonly label = input('');
  readonly childKeys = input<string[]>([]);
  readonly spec = input<Spec | null>(null);
}

@Component({
  selector: 'demo-card',
  standalone: true,
  imports: [RenderSpecComponent],
  template: `
    <div class="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 my-2">
      @if (title()) {
        <h3 class="text-sm font-semibold text-gray-200 mb-2">{{ title() }}</h3>
      }
      @if (spec() && childKeys().length) {
        @for (key of childKeys(); track key) {
          <render-spec [spec]="spec()" [elementKey]="key" />
        }
      }
    </div>
  `,
})
class DemoCardComponent {
  readonly title = input('');
  readonly childKeys = input<string[]>([]);
  readonly spec = input<Spec | null>(null);
}

@Component({
  selector: 'app-spec-rendering',
  standalone: true,
  imports: [RenderSpecComponent, StreamingTimelineComponent],
  template: `
    <div class="flex flex-col h-screen bg-gray-950 text-gray-100">
      <!-- Spec picker -->
      <div class="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
        <span class="text-xs text-gray-500 uppercase tracking-wide font-semibold mr-2">Spec:</span>
        @for (spec of specs; track spec.label; let i = $index) {
          <button
            class="text-xs px-3 py-1.5 rounded-md transition-colors"
            [class]="i === activeIndex ? 'bg-indigo-500 text-white font-semibold' : 'bg-gray-800 text-gray-400 hover:text-gray-200'"
            (click)="selectSpec(i)">
            {{ spec.label }}
          </button>
        }
      </div>

      <!-- Split panes -->
      <div class="flex flex-1 min-h-0">
        <!-- Left: Live Render Output -->
        <div class="flex-1 overflow-y-auto p-6 border-r border-gray-800">
          <div class="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-4">Live Render Output</div>
          @if (simulator.spec(); as renderedSpec) {
            <render-spec [spec]="renderedSpec" [registry]="registry" [store]="store" [loading]="simulator.playing()" />
          } @else {
            <div class="text-gray-600 text-sm italic">Press play to start streaming...</div>
          }
        </div>

        <!-- Right: Streaming JSON -->
        <div class="w-80 shrink-0 overflow-y-auto p-4 bg-gray-900/50">
          <div class="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-4">Streaming JSON</div>
          <pre class="text-[11px] font-mono text-gray-300 leading-relaxed whitespace-pre-wrap break-all">{{ simulator.rawJson() }}<span class="text-indigo-400 animate-pulse">|</span></pre>
          <div class="mt-3 flex justify-between text-[10px]">
            <span class="text-indigo-400">{{ simulator.playing() ? 'Streaming...' : simulator.position() >= simulator.total() ? 'Complete' : 'Paused' }}</span>
            <span class="text-gray-500">{{ simulator.progress() * 100 | number:'1.0-0' }}% parsed</span>
          </div>
        </div>
      </div>

      <!-- Timeline bar -->
      <streaming-timeline [simulator]="simulator" class="border-t border-gray-800" />
    </div>
  `,
})
export class SpecRenderingComponent implements OnDestroy {
  protected readonly specs = SPEC_RENDERING_SPECS;
  protected activeIndex = 0;
  protected readonly simulator = new StreamingSimulator(this.specs[0].json);

  protected readonly registry = defineAngularRegistry({
    Text: DemoTextComponent,
    Heading: DemoHeadingComponent,
    Badge: DemoBadgeComponent,
    Card: DemoCardComponent,
  });

  protected readonly store = signalStateStore({});

  selectSpec(index: number): void {
    this.activeIndex = index;
    this.simulator.setSource(this.specs[index].json);
    this.simulator.play();
  }

  ngOnDestroy(): void {
    this.simulator.destroy();
  }
}
```

- [ ] **Step 3: Verify it builds**

Run: `PATH="/Users/blove/.nvm/versions/node/v22.14.0/bin:$PATH" npx nx reset && npx nx build cockpit-render-spec-rendering-angular --configuration=development 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add cockpit/render/spec-rendering/angular/src/app/specs.ts cockpit/render/spec-rendering/angular/src/app/spec-rendering.component.ts
git commit -m "feat(cockpit): rewrite spec-rendering with streaming simulation"
```

---

## Task 4: Rewrite element-rendering Example

**Files:**
- Create: `cockpit/render/element-rendering/angular/src/app/specs.ts`
- Modify: `cockpit/render/element-rendering/angular/src/app/element-rendering.component.ts`

- [ ] **Step 1: Create specs data file**

```typescript
// cockpit/render/element-rendering/angular/src/app/specs.ts
import type { DemoSpec } from '../../../../../../render/spec-rendering/angular/src/app/specs';
export type { DemoSpec };

export const ELEMENT_RENDERING_SPECS: DemoSpec[] = [
  {
    label: 'Parent + Children',
    json: JSON.stringify({
      root: 'root',
      elements: {
        root: {
          type: 'Heading',
          props: { content: 'Parent Element' },
          children: ['child1', 'child2'],
        },
        child1: {
          type: 'Text',
          props: { content: 'First child element — always visible' },
        },
        child2: {
          type: 'Text',
          props: { content: 'Second child element — rendered after first' },
        },
      },
    }, null, 2),
  },
  {
    label: 'Deep Nesting',
    json: JSON.stringify({
      root: 'root',
      elements: {
        root: {
          type: 'Card',
          props: { title: 'Level 1' },
          children: ['level2'],
        },
        level2: {
          type: 'Card',
          props: { title: 'Level 2' },
          children: ['level3'],
        },
        level3: {
          type: 'Text',
          props: { content: 'Deepest level — three levels of nesting. The parser resolves each level as its type field arrives.' },
        },
      },
    }, null, 2),
  },
  {
    label: 'Visibility Conditions',
    json: JSON.stringify({
      root: 'root',
      elements: {
        root: {
          type: 'Heading',
          props: { content: 'Conditional Rendering' },
          children: ['always', 'conditional'],
        },
        always: {
          type: 'Text',
          props: { content: 'This element is always visible.' },
        },
        conditional: {
          type: 'Text',
          props: { content: 'This element has a visibility condition bound to state.' },
          visible: { bind: '/showDetail' },
        },
      },
    }, null, 2),
  },
];
```

- [ ] **Step 2: Rewrite element-rendering component**

Follow the same pattern as Task 3's spec-rendering component but:
- Import `ELEMENT_RENDERING_SPECS` from `./specs`
- Include the same inline demo components (DemoTextComponent, DemoHeadingComponent, DemoCardComponent)
- Use `signalStateStore({ showDetail: true })` for the visibility demo
- Selector: `app-element-rendering`
- Same layout: spec picker, split panes (render + JSON), timeline bar

- [ ] **Step 3: Verify it builds**

Run: `PATH="/Users/blove/.nvm/versions/node/v22.14.0/bin:$PATH" npx nx build cockpit-render-element-rendering-angular --configuration=development 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add cockpit/render/element-rendering/angular/src/app/
git commit -m "feat(cockpit): rewrite element-rendering with streaming simulation"
```

---

## Task 5: Rewrite state-management Example

**Files:**
- Create: `cockpit/render/state-management/angular/src/app/specs.ts`
- Modify: `cockpit/render/state-management/angular/src/app/state-management.component.ts`

- [ ] **Step 1: Create specs and rewrite component**

Specs focus on state-bound rendering: form inputs with `/user/name`, `/user/age` paths, and a display spec that reads from state.

Component: Same layout pattern. Registry includes DemoTextComponent, DemoHeadingComponent. Store initialized with `{ user: { name: 'Alice', age: 30 }, settings: { theme: 'dark' } }`. The sidebar shows `store.getSnapshot() | json` below the streaming JSON.

- [ ] **Step 2: Verify and commit**

```bash
git add cockpit/render/state-management/angular/src/app/
git commit -m "feat(cockpit): rewrite state-management with streaming simulation"
```

---

## Task 6: Rewrite registry Example

**Files:**
- Create: `cockpit/render/registry/angular/src/app/specs.ts`
- Modify: `cockpit/render/registry/angular/src/app/registry.component.ts`

- [ ] **Step 1: Create specs and rewrite component**

Specs use 3+ registered types to show registry resolution during streaming. Sidebar shows `registry.names()` list.

- [ ] **Step 2: Verify and commit**

```bash
git add cockpit/render/registry/angular/src/app/
git commit -m "feat(cockpit): rewrite registry with streaming simulation"
```

---

## Task 7: Rewrite repeat-loops Example

**Files:**
- Create: `cockpit/render/repeat-loops/angular/src/app/specs.ts`
- Modify: `cockpit/render/repeat-loops/angular/src/app/repeat-loops.component.ts`

- [ ] **Step 1: Create specs and rewrite component**

Specs demonstrate array elements with `children` arrays of varying lengths. Items appear one by one as the parser encounters them. Store has `{ items: ['Alpha', 'Beta', 'Gamma'] }`.

- [ ] **Step 2: Verify and commit**

```bash
git add cockpit/render/repeat-loops/angular/src/app/
git commit -m "feat(cockpit): rewrite repeat-loops with streaming simulation"
```

---

## Task 8: Rewrite computed-functions Example

**Files:**
- Create: `cockpit/render/computed-functions/angular/src/app/specs.ts`
- Modify: `cockpit/render/computed-functions/angular/src/app/computed-functions.component.ts`

- [ ] **Step 1: Create specs and rewrite component**

Specs demonstrate elements whose props would use computed functions. `provideRender()` in `app.config.ts` already has custom functions with correct `(args: Record<string, unknown>) => unknown` signature. Sidebar shows function names.

- [ ] **Step 2: Verify and commit**

```bash
git add cockpit/render/computed-functions/angular/src/app/
git commit -m "feat(cockpit): rewrite computed-functions with streaming simulation"
```

---

## Task 9: Update E2E Tests

**Files:**
- Modify: `cockpit/render/spec-rendering/angular/e2e/spec-rendering.spec.ts`
- Modify: `cockpit/render/element-rendering/angular/e2e/element-rendering.spec.ts`
- Modify: `cockpit/render/state-management/angular/e2e/state-management.spec.ts`
- Modify: `cockpit/render/registry/angular/e2e/registry.spec.ts`
- Modify: `cockpit/render/repeat-loops/angular/e2e/repeat-loops.spec.ts`
- Modify: `cockpit/render/computed-functions/angular/e2e/computed-functions.spec.ts`

- [ ] **Step 1: Update all 6 e2e tests**

Each test should verify:
- The spec picker buttons render
- The timeline component renders (play button, scrubber)
- The streaming JSON pane is visible

Example for spec-rendering:
```typescript
// cockpit/render/spec-rendering/angular/e2e/spec-rendering.spec.ts
import { expect, test } from '@playwright/test';

test.describe('Render Spec Rendering Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4401');
    await page.waitForSelector('app-spec-rendering', { state: 'attached' });
  });

  test('renders spec picker and timeline', async ({ page }) => {
    await expect(page.locator('button', { hasText: 'Heading + Text' })).toBeVisible();
    await expect(page.locator('streaming-timeline')).toBeVisible();
  });

  test('shows streaming JSON pane', async ({ page }) => {
    await expect(page.locator('pre')).toBeVisible();
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add cockpit/render/*/angular/e2e/
git commit -m "test(cockpit): update render example e2e tests for streaming simulation"
```

---

## Task 10: Verify All Builds and Tests

- [ ] **Step 1: Run all vitest tests**

```bash
PATH="/Users/blove/.nvm/versions/node/v22.14.0/bin:$PATH" npx vitest run cockpit/render/shared/ cockpit/render/matrix.spec.ts cockpit/render/footprint.spec.ts
```
Expected: All pass

- [ ] **Step 2: Build all 6 render examples**

```bash
PATH="/Users/blove/.nvm/versions/node/v22.14.0/bin:$PATH" npx nx reset
for topic in spec-rendering element-rendering state-management registry repeat-loops computed-functions; do
  echo "=== $topic ==="
  npx nx build cockpit-render-$topic-angular --configuration=development 2>&1 | tail -3
done
```
Expected: All 6 build successfully

- [ ] **Step 3: Start spec-rendering and verify in browser**

```bash
PATH="/Users/blove/.nvm/versions/node/v22.14.0/bin:$PATH" npx nx serve cockpit-render-spec-rendering-angular --port 4401
```

Verify:
- Spec picker shows 3 buttons
- Clicking a spec starts streaming
- Timeline bar shows play/pause, scrubber, speed controls
- Left pane renders progressively
- Right pane shows JSON with cursor
- Scrubbing works in both directions

- [ ] **Step 4: Push and verify CI**

```bash
git push --force-with-lease
gh pr checks 68 --watch
```
