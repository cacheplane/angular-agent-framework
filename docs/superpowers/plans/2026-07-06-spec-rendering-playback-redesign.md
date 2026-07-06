# Spec-Rendering Playback Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the spec-rendering example's playback UI (and the shared transport timeline it uses) with encapsulated Angular component styles on the real `--ds-*` design tokens, eliminating all Tailwind utility classes so it renders styled standalone and embedded, in light and dark themes.

**Architecture:** Angular always compiles component `styles:` regardless of Tailwind, so the fix is to move every visual rule off Tailwind utilities into scoped component CSS driven by theme-aware `--ds-*` tokens. Structure is unchanged (spec tabs → split render/JSON → transport footer) and reuses the working `ExampleSplitLayoutComponent` frame. Accent is render-green: `--ds-render-green` (`#1a7a40`) for solid fills, a local brighter `#35b06a` for on-dark text/glows. A new truncation-tolerant JSON syntax-highlighter colorizes the streaming JSON.

**Tech Stack:** Angular (standalone components, signals, control-flow syntax), `@threadplane/render`, `@threadplane/design-tokens` (`--ds-*` CSS vars), Vitest (node env, globals) for the highlighter unit tests, Nx.

**Design reference:** `docs/superpowers/specs/2026-07-06-spec-rendering-playback-redesign-design.md`

---

## File structure

- **Create** `cockpit/render/spec-rendering/angular/src/app/json-highlight.ts` — pure, truncation-tolerant JSON tokenizer for syntax highlighting.
- **Create** `cockpit/render/spec-rendering/angular/src/app/json-highlight.spec.ts` — unit tests (Vitest).
- **Modify** `cockpit/render/shared/streaming-timeline.component.ts` — replace Tailwind template classes with encapsulated `styles:` (render-green). Shared by all 6 render examples; drag logic unchanged.
- **Modify** `cockpit/render/spec-rendering/angular/src/app/spec-rendering.component.ts` — full rewrite of the 4 inline demo components + the shell component (header tabs + status pulse, render pane, syntax-colored JSON pane).
- **Modify** `cockpit/render/spec-rendering/angular/src/styles.css` — `--ds-*`-based body + shared `.sr-skeleton` loader; drop the old Tailwind-oriented shimmer.

---

## Task 1: JSON syntax-highlighter utility (TDD)

**Files:**
- Create: `cockpit/render/spec-rendering/angular/src/app/json-highlight.ts`
- Test: `cockpit/render/spec-rendering/angular/src/app/json-highlight.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `cockpit/render/spec-rendering/angular/src/app/json-highlight.spec.ts`:

```ts
// SPDX-License-Identifier: MIT
import { highlightJson } from './json-highlight';

describe('highlightJson', () => {
  it('returns no tokens for empty input', () => {
    expect(highlightJson('')).toEqual([]);
  });

  it('classifies an object key vs a string value', () => {
    const toks = highlightJson('{"type": "Card"}');
    expect(toks.find((t) => t.text === '"type"')?.kind).toBe('key');
    expect(toks.find((t) => t.text === '"Card"')?.kind).toBe('string');
  });

  it('marks structural characters as punct', () => {
    const puncts = highlightJson('{}[],:').filter((t) => t.kind === 'punct');
    expect(puncts.map((t) => t.text)).toEqual(['{', '}', '[', ']', ',', ':']);
  });

  it('tokenizes numbers including negatives and exponents', () => {
    const nums = highlightJson('[1, -2.5, 3e4]').filter((t) => t.kind === 'number');
    expect(nums.map((t) => t.text)).toEqual(['1', '-2.5', '3e4']);
  });

  it('tokenizes true/false/null as literals', () => {
    const lits = highlightJson('[true, false, null]').filter((t) => t.kind === 'literal');
    expect(lits.map((t) => t.text)).toEqual(['true', 'false', 'null']);
  });

  it('treats an unterminated trailing string as a plain string, not a key', () => {
    const toks = highlightJson('{"title": "Streaming De');
    expect(toks.find((t) => t.text === '"title"')?.kind).toBe('key');
    const last = toks[toks.length - 1];
    expect(last.text).toBe('"Streaming De');
    expect(last.kind).toBe('string');
  });

  it('is loss-less: joining token texts reproduces the input', () => {
    const sample = '{\n  "root": "root",\n  "elements": {\n    "a": { "type": "Card" }\n  }\n}';
    expect(highlightJson(sample).map((t) => t.text).join('')).toBe(sample);
  });

  it('preserves whitespace as plain tokens', () => {
    const toks = highlightJson('{ }');
    expect(toks.map((t) => t.text).join('')).toBe('{ }');
    expect(toks.some((t) => t.kind === 'plain' && t.text === ' ')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run cockpit/render/spec-rendering/angular/src/app/json-highlight.spec.ts`
Expected: FAIL — cannot resolve `./json-highlight`.

- [ ] **Step 3: Write the implementation**

Create `cockpit/render/spec-rendering/angular/src/app/json-highlight.ts`:

```ts
// SPDX-License-Identifier: MIT

export type JsonTokenKind = 'key' | 'string' | 'punct' | 'number' | 'literal' | 'plain';

export interface JsonToken {
  text: string;
  kind: JsonTokenKind;
}

const PUNCT = new Set(['{', '}', '[', ']', ':', ',']);
const WS = new Set([' ', '\n', '\r', '\t']);
const isWs = (c: string) => WS.has(c);
const isDigit = (c: string) => c >= '0' && c <= '9';
const isAlpha = (c: string) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
const isNumberPart = (c: string) => isDigit(c) || c === '.' || c === 'e' || c === 'E' || c === '+' || c === '-';

/**
 * Tokenize a (possibly incomplete) streaming JSON string for syntax
 * highlighting. Never throws; tolerant of truncation. A string token is
 * classified as a `key` only when it is properly closed AND the next
 * non-whitespace character is a colon; the trailing (possibly unterminated)
 * string has no colon yet and is emitted as a plain string. The token stream
 * is loss-less — concatenating every token's `text` reproduces the input.
 */
export function highlightJson(raw: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  const n = raw.length;
  let i = 0;

  while (i < n) {
    const ch = raw[i];

    if (isWs(ch)) {
      let j = i + 1;
      while (j < n && isWs(raw[j])) j++;
      tokens.push({ text: raw.slice(i, j), kind: 'plain' });
      i = j;
      continue;
    }

    if (PUNCT.has(ch)) {
      tokens.push({ text: ch, kind: 'punct' });
      i += 1;
      continue;
    }

    if (ch === '"') {
      let j = i + 1;
      let closed = false;
      while (j < n) {
        if (raw[j] === '\\') { j += 2; continue; }
        if (raw[j] === '"') { j += 1; closed = true; break; }
        j += 1;
      }
      const text = raw.slice(i, Math.min(j, n));
      let k = j;
      while (k < n && isWs(raw[k])) k++;
      const isKey = closed && k < n && raw[k] === ':';
      tokens.push({ text, kind: isKey ? 'key' : 'string' });
      i = Math.min(j, n);
      continue;
    }

    if (ch === '-' || isDigit(ch)) {
      let j = i + 1;
      while (j < n && isNumberPart(raw[j])) j++;
      tokens.push({ text: raw.slice(i, j), kind: 'number' });
      i = j;
      continue;
    }

    if (isAlpha(ch)) {
      let j = i + 1;
      while (j < n && isAlpha(raw[j])) j++;
      tokens.push({ text: raw.slice(i, j), kind: 'literal' });
      i = j;
      continue;
    }

    tokens.push({ text: ch, kind: 'plain' });
    i += 1;
  }

  return tokens;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run cockpit/render/spec-rendering/angular/src/app/json-highlight.spec.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add cockpit/render/spec-rendering/angular/src/app/json-highlight.ts cockpit/render/spec-rendering/angular/src/app/json-highlight.spec.ts
git commit -m "feat(cockpit-render): truncation-tolerant JSON syntax tokenizer"
```

---

## Task 2: Restyle the shared streaming-timeline (render-green)

**Files:**
- Modify: `cockpit/render/shared/streaming-timeline.component.ts`

- [ ] **Step 1: Replace the component's template + add encapsulated styles**

Replace the `template:` in the `@Component` decorator and add a `styles:` block, leaving the class body (imports, `simulator` input, `track` viewChild, `speeds`, and all `onTrack*`/`seekFrom*` methods) **unchanged**. The decorator becomes:

```ts
@Component({
  selector: 'streaming-timeline',
  standalone: true,
  styles: `
    :host {
      --tl-green: var(--ds-render-green, #1a7a40);
      --tl-green-bright: #35b06a;
      display: block;
    }
    .tl {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      background: var(--ds-surface, #1c1c1c);
      border-top: 1px solid var(--ds-border, #2d2d2d);
    }
    .tl__play {
      width: 34px;
      height: 34px;
      border-radius: 999px;
      border: 0;
      flex-shrink: 0;
      color: #eafff2;
      background: var(--tl-green);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 2px 12px rgba(26, 122, 64, 0.5);
      transition: transform 0.1s ease, box-shadow 0.15s ease;
    }
    .tl__play:hover { box-shadow: 0 3px 16px rgba(53, 176, 106, 0.6); }
    .tl__play:active { transform: scale(0.94); }
    .tl__track {
      flex: 1;
      position: relative;
      height: 6px;
      border-radius: 999px;
      background: var(--ds-surface-tinted, #2c2c2c);
      cursor: pointer;
    }
    .tl__fill {
      position: absolute;
      inset: 0 auto 0 0;
      border-radius: 999px;
      background: linear-gradient(90deg, var(--tl-green), var(--tl-green-bright));
    }
    .tl__handle {
      position: absolute;
      top: 50%;
      width: 15px;
      height: 15px;
      border-radius: 999px;
      background: #fff;
      border: 2px solid var(--tl-green-bright);
      transform: translate(-50%, -50%);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
      transition: left 0.075s linear;
    }
    .tl__count {
      flex-shrink: 0;
      min-width: 100px;
      text-align: right;
      font-family: var(--ds-font-mono, ui-monospace, monospace);
      font-size: 11px;
      color: var(--ds-text-muted, #a0a0a0);
      font-variant-numeric: tabular-nums;
    }
    .tl__count b { color: var(--ds-text-primary, #f5f5f5); font-weight: 600; }
    .tl__speeds { display: flex; gap: 4px; flex-shrink: 0; }
    .tl__speed {
      font-size: 10.5px;
      padding: 5px 10px;
      border-radius: 7px;
      border: 1px solid var(--ds-border, #2d2d2d);
      background: var(--ds-surface-dim, #0a0a0a);
      color: var(--ds-text-muted, #a0a0a0);
      cursor: pointer;
      transition: color 0.12s ease, background 0.12s ease, border-color 0.12s ease;
    }
    .tl__speed:hover { color: var(--ds-text-secondary, #c8c8c8); }
    .tl__speed--on {
      color: var(--tl-green-bright);
      border-color: rgba(53, 176, 106, 0.35);
      background: rgba(53, 176, 106, 0.12);
      font-weight: 600;
    }
  `,
  template: `
    <div class="tl">
      <button class="tl__play" type="button" aria-label="Play or pause" (click)="simulator().toggle()">
        @if (simulator().playing()) {
          <svg width="13" height="13" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
            <rect x="3" y="2" width="3" height="10" rx="1" />
            <rect x="8" y="2" width="3" height="10" rx="1" />
          </svg>
        } @else {
          <svg width="13" height="13" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
            <polygon points="4,2 12,7 4,12" />
          </svg>
        }
      </button>

      <div
        #track
        class="tl__track"
        (mousedown)="onTrackMouseDown($event)"
        (touchstart)="onTrackTouchStart($event)">
        <div class="tl__fill" [style.width.%]="simulator().progress() * 100"></div>
        <div class="tl__handle" [style.left.%]="simulator().progress() * 100"></div>
      </div>

      <div class="tl__count"><b>{{ simulator().position() }}</b> / {{ simulator().total() }} chars</div>

      <div class="tl__speeds">
        @for (s of speeds; track s) {
          <button
            type="button"
            class="tl__speed"
            [class.tl__speed--on]="simulator().speed() === s"
            (click)="simulator().setSpeed(s)">
            {{ s }}x
          </button>
        }
      </div>
    </div>
  `,
})
```

- [ ] **Step 2: Verify no Tailwind utilities remain**

Run: `grep -nE 'class="[^"]*(px-|py-|text-\[|bg-\[|rounded|flex |gap-|w-[0-9]|h-[0-9]|from-|to-|shadow-|tabular|shrink|inset|absolute|relative)' cockpit/render/shared/streaming-timeline.component.ts`
Expected: no output (exit 1 — no matches).

- [ ] **Step 3: Type-check the shared file compiles**

Run: `npx tsc --noEmit -p cockpit/render/spec-rendering/angular/tsconfig.app.json`
Expected: no errors (the spec-rendering app imports this shared component, so its tsconfig covers it).

- [ ] **Step 4: Commit**

```bash
git add cockpit/render/shared/streaming-timeline.component.ts
git commit -m "feat(cockpit-render): restyle streaming transport timeline with encapsulated CSS on --ds-* tokens"
```

---

## Task 3: Rewrite spec-rendering component (demo components + shell)

**Files:**
- Modify: `cockpit/render/spec-rendering/angular/src/app/spec-rendering.component.ts`

- [ ] **Step 1: Replace the whole file**

Replace the entire contents of `cockpit/render/spec-rendering/angular/src/app/spec-rendering.component.ts` with:

```ts
// SPDX-License-Identifier: MIT
import { Component, computed, input, OnDestroy, viewChild, ElementRef, effect } from '@angular/core';
import {
  RenderSpecComponent,
  RenderElementComponent,
  defineAngularRegistry,
  signalStateStore,
} from '@threadplane/render';
import type { Spec } from '@json-render/core';
import { StreamingTimelineComponent } from '../../../../shared/streaming-timeline.component';
import { ExampleSplitLayoutComponent } from '@threadplane/example-layouts';
import { SPEC_RENDERING_SPECS } from './specs';
import { highlightJson } from './json-highlight';

// --- Inline view components registered in the demo registry ---

@Component({
  selector: 'demo-text',
  standalone: true,
  styles: `.t { margin: 0; font-size: 13px; line-height: 1.55; color: var(--ds-text-secondary, #c8c8c8); }`,
  template: `
    @if (displayContent()) {
      <p class="t">{{ displayContent() }}</p>
    } @else if (loading()) {
      <div class="sr-skeleton" style="height: 11px; width: 100%; margin: 3px 0;"></div>
      <div class="sr-skeleton" style="height: 11px; width: 66%; margin: 3px 0;"></div>
    }
  `,
})
class DemoTextComponent {
  readonly content = input<unknown>('');
  readonly displayContent = computed(() => {
    const c = this.content();
    return typeof c === 'string' ? c : '';
  });
  readonly childKeys = input<string[]>([]);
  readonly spec = input<Spec | null>(null);
  readonly bindings = input<Record<string, string>>({});
  readonly emit = input<(event: string) => void>(() => {});
  readonly loading = input(false);
}

@Component({
  selector: 'demo-heading',
  standalone: true,
  imports: [RenderElementComponent],
  styles: `.h { margin: 0 0 0.5rem; font-size: 1.05rem; font-weight: 700; color: var(--ds-text-primary, #f5f5f5); }`,
  template: `
    @if (displayContent()) {
      <h2 class="h">{{ displayContent() }}</h2>
    } @else if (loading()) {
      <div class="sr-skeleton" style="height: 18px; width: 12rem; margin-bottom: 0.5rem;"></div>
    }
    @for (key of childKeys(); track key) {
      <render-element [elementKey]="key" [spec]="spec()!" />
    }
  `,
})
class DemoHeadingComponent {
  readonly content = input<unknown>('');
  readonly displayContent = computed(() => {
    const c = this.content();
    return typeof c === 'string' ? c : '';
  });
  readonly childKeys = input<string[]>([]);
  readonly spec = input<Spec | null>(null);
  readonly bindings = input<Record<string, string>>({});
  readonly emit = input<(event: string) => void>(() => {});
  readonly loading = input(false);
}

@Component({
  selector: 'demo-badge',
  standalone: true,
  styles: `
    .b {
      display: inline-block;
      margin-bottom: 0.5rem;
      padding: 3px 10px;
      font-size: 11px;
      font-weight: 600;
      border-radius: 999px;
      color: #35b06a;
      background: rgba(53, 176, 106, 0.12);
      border: 1px solid rgba(53, 176, 106, 0.35);
    }
  `,
  template: `<span class="b">{{ label() }}</span>`,
})
class DemoBadgeComponent {
  readonly label = input('');
  readonly childKeys = input<string[]>([]);
  readonly spec = input<Spec | null>(null);
  readonly bindings = input<Record<string, string>>({});
  readonly emit = input<(event: string) => void>(() => {});
  readonly loading = input(false);
}

@Component({
  selector: 'demo-card',
  standalone: true,
  imports: [RenderElementComponent],
  styles: `
    .card {
      margin-bottom: 0.75rem;
      padding: 16px;
      background: var(--ds-surface, #1c1c1c);
      border: 1px solid var(--ds-border, #2d2d2d);
      border-radius: var(--ds-radius-lg, 14px);
      box-shadow: var(--ds-shadow-md, 0 4px 6px -1px rgba(0, 0, 0, 0.3));
    }
    .card__title {
      margin: 0 0 0.625rem;
      font-size: 13px;
      font-weight: 600;
      color: var(--ds-text-primary, #f5f5f5);
    }
  `,
  template: `
    <div class="card">
      @if (title()) {
        <div class="card__title">{{ title() }}</div>
      } @else if (loading()) {
        <div class="sr-skeleton" style="height: 14px; width: 8rem; margin-bottom: 0.625rem;"></div>
      }
      @if (childKeys().length) {
        @for (key of childKeys(); track key) {
          <render-element [elementKey]="key" [spec]="spec()!" />
        }
      } @else if (loading()) {
        <div class="sr-skeleton" style="height: 11px; width: 100%; margin: 4px 0;"></div>
        <div class="sr-skeleton" style="height: 11px; width: 75%; margin: 4px 0;"></div>
      }
    </div>
  `,
})
class DemoCardComponent {
  readonly title = input('');
  readonly childKeys = input<string[]>([]);
  readonly spec = input<Spec | null>(null);
  readonly bindings = input<Record<string, string>>({});
  readonly emit = input<(event: string) => void>(() => {});
  readonly loading = input(false);
}

@Component({
  selector: 'app-spec-rendering',
  standalone: true,
  imports: [RenderSpecComponent, StreamingTimelineComponent, ExampleSplitLayoutComponent],
  styles: `
    .bar { display: flex; align-items: center; gap: 0.875rem; padding: 0.75rem 1rem; }
    .bar__lbl {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--ds-text-muted, #a0a0a0);
    }
    .tabs {
      display: flex;
      gap: 4px;
      padding: 4px;
      border-radius: 999px;
      background: var(--ds-surface-dim, #0a0a0a);
      border: 1px solid var(--ds-border, #2d2d2d);
    }
    .tab {
      padding: 6px 14px;
      font-size: 12px;
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: var(--ds-text-muted, #a0a0a0);
      cursor: pointer;
      transition: color 0.15s ease, background 0.15s ease;
    }
    .tab:hover { color: var(--ds-text-secondary, #c8c8c8); }
    .tab--on {
      background: var(--ds-render-green, #1a7a40);
      color: #eafff2;
      font-weight: 600;
      box-shadow: 0 1px 8px rgba(26, 122, 64, 0.5);
    }
    .status {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 7px;
      font-size: 11px;
      color: var(--ds-text-muted, #a0a0a0);
    }
    .status__dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #35b06a;
      box-shadow: 0 0 0 4px rgba(53, 176, 106, 0.13);
    }
    .status__dot--live { animation: sr-pulse 1.6s ease-in-out infinite; }
    @keyframes sr-pulse { 50% { opacity: 0.4; } }
    .cap {
      margin-bottom: 1rem;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: var(--ds-text-muted, #a0a0a0);
    }
    .placeholder { font-size: 13px; font-style: italic; color: var(--ds-text-muted, #a0a0a0); }
    .json-pane {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      padding: 1rem;
      background: var(--ds-surface-dim, #0a0a0a);
    }
    .json {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      margin: 0;
      font-family: var(--ds-font-mono, ui-monospace, monospace);
      font-size: 11.5px;
      line-height: 1.7;
      white-space: pre-wrap;
      word-break: break-all;
      color: var(--ds-text-secondary, #c8c8c8);
    }
    .json .j-key { color: #7fe0a3; }
    .json .j-string { color: #c9c17f; }
    .json .j-number { color: #e6b673; }
    .json .j-literal { color: #7fd6ff; }
    .json .j-punct { color: var(--ds-text-muted, #a0a0a0); }
    .json__cursor {
      display: inline-block;
      width: 7px;
      height: 14px;
      vertical-align: -2px;
      background: #35b06a;
      animation: sr-blink 1s step-end infinite;
    }
    @keyframes sr-blink { 50% { opacity: 0; } }
    .json__foot {
      display: flex;
      justify-content: space-between;
      margin-top: 0.75rem;
      padding-top: 0.625rem;
      font-size: 10.5px;
      border-top: 1px solid var(--ds-border, #2d2d2d);
    }
    .json__foot .state { color: #35b06a; font-weight: 600; }
    .json__foot .state--idle { color: var(--ds-text-muted, #a0a0a0); font-weight: 400; }
    .json__foot .pct { color: var(--ds-text-muted, #a0a0a0); font-variant-numeric: tabular-nums; }
  `,
  template: `
    <example-split-layout>
      <!-- Spec picker + streaming status -->
      <div header class="bar">
        <span class="bar__lbl">Spec</span>
        <div class="tabs">
          @for (spec of specs; track spec.label; let i = $index) {
            <button type="button" class="tab" [class.tab--on]="i === activeIndex" (click)="selectSpec(i)">
              {{ spec.label }}
            </button>
          }
        </div>
        <span class="status">
          <span class="status__dot" [class.status__dot--live]="simulator.playing()"></span>
          {{ statusLabel() }}
        </span>
      </div>

      <!-- Left: live render output -->
      <div primary>
        <div class="cap">Live Render Output</div>
        @if (simulator.spec(); as renderedSpec) {
          <render-spec [spec]="renderedSpec" [registry]="registry" [store]="store" [loading]="simulator.playing()" />
        } @else {
          <div class="placeholder">Press play to start streaming…</div>
        }
      </div>

      <!-- Right: syntax-colored streaming JSON -->
      <div secondary>
        <div class="json-pane">
          <div class="cap">Streaming JSON</div>
          <pre class="json" #jsonScroll>@for (tok of jsonTokens(); track $index) {<span [class]="'j-' + tok.kind">{{ tok.text }}</span>}<span class="json__cursor"></span></pre>
          <div class="json__foot">
            <span class="state" [class.state--idle]="!simulator.playing()">{{ streamStateLabel() }}</span>
            <span class="pct">{{ percent() }}%</span>
          </div>
        </div>
      </div>

      <!-- Transport -->
      <streaming-timeline footer [simulator]="simulator" />
    </example-split-layout>
  `,
})
export class SpecRenderingComponent implements OnDestroy {
  protected readonly specs = SPEC_RENDERING_SPECS;
  protected activeIndex = 0;

  protected readonly simulator = new StreamingSimulator(this.specs[0].json);

  protected readonly jsonTokens = computed(() => highlightJson(this.simulator.rawJson()));

  private readonly jsonScroll = viewChild<ElementRef<HTMLElement>>('jsonScroll');

  constructor() {
    effect(() => {
      this.simulator.rawJson();
      const el = this.jsonScroll()?.nativeElement;
      if (el) {
        requestAnimationFrame(() => {
          el.scrollTop = el.scrollHeight;
        });
      }
    });
  }

  protected readonly registry = defineAngularRegistry({
    Text: DemoTextComponent,
    Heading: DemoHeadingComponent,
    Badge: DemoBadgeComponent,
    Card: DemoCardComponent,
  });

  protected readonly store = signalStateStore({});

  protected percent(): number {
    return Math.round(this.simulator.progress() * 100);
  }

  protected statusLabel(): string {
    if (this.simulator.playing()) return 'Streaming';
    return this.simulator.position() >= this.simulator.total() ? 'Complete' : 'Paused';
  }

  protected streamStateLabel(): string {
    if (this.simulator.playing()) return 'Streaming…';
    return this.simulator.position() >= this.simulator.total() ? 'Complete' : 'Paused';
  }

  protected selectSpec(index: number): void {
    this.activeIndex = index;
    this.simulator.setSource(this.specs[index].json);
    this.simulator.play();
  }

  ngOnDestroy(): void {
    this.simulator.destroy();
  }
}
```

> **Whitespace note:** the `<pre class="json" #jsonScroll>@for (…) {<span …>{{ tok.text }}</span>}<span class="json__cursor"></span></pre>` line MUST stay on a single line with no spaces/newlines between `>` `@for`, `{`, `<span>`, `}`, and the cursor span. Token text carries all real whitespace; any template whitespace inside `<pre>` would render as stray gaps.

- [ ] **Step 2: Add the missing StreamingSimulator import**

The class instantiates `new StreamingSimulator(...)`. Add it to the imports at the top of the file (alongside the existing `StreamingTimelineComponent` import):

```ts
import { StreamingSimulator } from '../../../../shared/streaming-simulator';
```

- [ ] **Step 3: Verify no Tailwind utilities remain in the file**

Run: `grep -nE 'class="[^"]*(px-|py-|text-\[|text-\(|bg-\[|rounded|flex |gap-|w-[0-9]|h-[0-9]|from-|to-|shadow-|tabular|shrink|inset|absolute|animate-|uppercase|tracking|space-y|leading-|border-\[)' cockpit/render/spec-rendering/angular/src/app/spec-rendering.component.ts`
Expected: no output (exit 1). Only plain scoped class names (`tab`, `card`, `json`, `sr-skeleton`, etc.) remain.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p cockpit/render/spec-rendering/angular/tsconfig.app.json`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add cockpit/render/spec-rendering/angular/src/app/spec-rendering.component.ts
git commit -m "feat(cockpit-render): redesign spec-rendering playback UI with encapsulated CSS + syntax-colored JSON"
```

---

## Task 4: Update global styles.css

**Files:**
- Modify: `cockpit/render/spec-rendering/angular/src/styles.css`

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `cockpit/render/spec-rendering/angular/src/styles.css` with:

```css
@import "@threadplane/example-layouts/theme.css";

html,
body {
  height: 100%;
  margin: 0;
  background: var(--ds-canvas, #111);
  color: var(--ds-text-primary, #f5f5f5);
  font-family: var(--ds-font-sans, system-ui, sans-serif);
}

/* Shared skeleton loader for streamed-but-incomplete demo elements. */
.sr-skeleton {
  border-radius: 5px;
  background: linear-gradient(
    90deg,
    var(--ds-surface-tinted, #2c2c2c) 0%,
    rgba(90, 90, 90, 0.55) 50%,
    var(--ds-surface-tinted, #2c2c2c) 100%
  );
  background-size: 200% 100%;
  animation: sr-shimmer 1.5s ease-in-out infinite;
}

@keyframes sr-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

- [ ] **Step 2: Commit**

```bash
git add cockpit/render/spec-rendering/angular/src/styles.css
git commit -m "chore(cockpit-render): --ds-* body styling + shared sr-skeleton loader"
```

---

## Task 5: Integration gate — production build + smoke + Tailwind-free check

**Files:** none (verification only)

- [ ] **Step 1: Production build succeeds within budgets**

Run: `npx nx build cockpit-render-spec-rendering-angular --configuration=production`
Expected: build succeeds; no `anyComponentStyle` budget error (per-component CSS < 16kb) and no initial-bundle error (< 1.5mb).

- [ ] **Step 2: Smoke target passes (module shape intact)**

Run: `npx nx smoke cockpit-render-spec-rendering-angular`
Expected: exits 0 (no "Unexpected module shape" throw).

- [ ] **Step 3: Repo-wide Tailwind-free assertion for the three touched component/style files**

Run:
```bash
grep -REn 'class="[^"]*(px-|py-|text-\[|bg-\[|rounded-|gap-[0-9]|from-indigo|to-indigo|animate-pulse|space-y-|tracking-w)' \
  cockpit/render/shared/streaming-timeline.component.ts \
  cockpit/render/spec-rendering/angular/src/app/spec-rendering.component.ts
```
Expected: no output (exit 1).

- [ ] **Step 4: Highlighter tests still green**

Run: `npx vitest run cockpit/render/spec-rendering/angular/src/app/json-highlight.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit (if any incidental fixes were needed)**

Only if steps required edits. Otherwise skip.

---

## Task 6: Visual verification (orchestrator, Chrome MCP)

**Files:** none (manual/tool verification — performed by the orchestrator, not a subagent, since render e2e is manual and aimock is not applicable to render examples)

- [ ] **Step 1: Serve the example**

Run: `npx nx serve cockpit-render-spec-rendering-angular` (dev config). Note the served URL/port.

- [ ] **Step 2: Verify with Chrome MCP / preview**
  - Buttons/tabs have real padding, radius, and render-green active fill (no browser-default `padding:0`).
  - Pressing play streams: JSON is syntax-colored with a blinking cursor; the Card/Badge/Text render on the left with skeleton lines for not-yet-streamed children.
  - Scrubber drag seeks; speed toggles switch and highlight; status pulse reflects play state.

- [ ] **Step 3: Theme flip**
  - Confirm the UI renders correctly in both dark and light themes (tokens flip; the brighter green stays legible on both).

- [ ] **Step 4: Sibling regression check**
  - Serve/inspect one other render example (e.g. `cockpit-render-element-rendering-angular`) and confirm the restyled shared transport timeline renders correctly there too.

---

## Self-review

- **Spec coverage:** encapsulated CSS on `--ds-*` (Tasks 2–4) ✓; render-green two-role accent (Tasks 2–3) ✓; segmented tabs + status pulse (Task 3) ✓; skeleton loaders (Tasks 3–4) ✓; syntax-colored truncation-tolerant JSON (Tasks 1, 3) ✓; restyle shared timeline in place for all 6 examples (Task 2) ✓; `StreamingSimulator` untouched ✓; light/dark + sibling verification (Task 6) ✓; grep gate + build/smoke (Task 5) ✓.
- **Placeholder scan:** every code step contains complete code; no TBD/TODO.
- **Type consistency:** `JsonToken.kind` values (`key|string|punct|number|literal|plain`) map to `.j-<kind>` classes styled in Task 3; `highlightJson` signature matches its use in `jsonTokens`; `StreamingSimulator`/`StreamingTimelineComponent` APIs used unchanged.
