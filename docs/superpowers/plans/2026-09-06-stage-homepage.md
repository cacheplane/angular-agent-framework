# Stage on the Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the homepage's four capability `FeatureBlock`s with one pinned, scroll-scrubbed act that drives the demo app's `/stage` route (plan 2, PR #1030) through the `tplane-stage` protocol, with stacked stills as the fallback, the scroll-craft verification harness in e2e, and the stage analytics events.

**Architecture:** The website vendors scroll-craft's engine unmodified and mounts it on one `<section data-sc-act="pin" data-sc-span="6">`. Each frame, a publisher reads the act's `--sc-p`, maps it to recorded milliseconds through a pure beat map (`stage-beats.ts`), and posts `{ type: 'tplane-stage', t }` to the iframe; the iframe answers `ready` (timeline numbers) and `{ applied, phase, t }`, which the publisher writes into `data-sc-verify-state` so the harness can see a bespoke stage. The rail's cue windows are derived from the same beat shares, so copy and time cannot drift. Below 1024px, under reduced motion, without JavaScript, or when the frame never reports ready, the section renders four stacked stills with the same copy.

**Tech Stack:** Next.js (apps/website, React 19, Vitest, Playwright), scroll-craft engine (MIT, commit `0b81622`), the demo app's `/stage` route (Angular, `examples/chat/angular`), posthog-js analytics.

**Spec:** `docs/superpowers/specs/2026-09-05-homepage-live-stage-design.md` §4.1, §4.3, §5.2, §6, §7, §8, §9, §10. Plan 2 delivered §4.2, §4.4, §4.5, §5.1 and the stills recorder.

---

## Conventions

- Branch: `blove/stage-homepage`, created from `blove/stage-route` (this plan needs plan 2's code). Rebase onto `origin/main` once #1030 merges; never `git stash` (shared stack).
- Run every command from the repo root unless a step says otherwise. Website unit tests: `npx nx test website` (must run from the root, see memory). Only `npx nx build website` catches website type errors; run it before claiming green.
- Public copy: the rail copy lands in `positioning.ts` and is scanned by `src/lib/public-copy.spec.ts` (unit) and crawled by `e2e/public-copy.spec.ts` in production mode. Never write the banned phrasings in `src/lib/public-copy-contract.ts` (`BANNED_CLAIMS`), and no competitor names.
- Voice: `docs/gtm/voice.md`. Rail copy is taken verbatim from the existing FeatureBlocks in `app/page.tsx` and the spec §6; do not rewrite it.
- The demo origin is `https://demo.threadplane.ai`; the website's origins are already allowlisted in `examples/chat/angular/src/app/hero/hero-bridge.ts` (`HERO_PARENT_ORIGINS`, plus Vercel previews). The website e2e server is `http://127.0.0.1:4308`, which is in that list.
- The `/stage` route on the deployed demo exists only after #1030 merges AND the canonical demo deploy promotes. Tasks 1–8 need no network. Task 9's live-frame assertions are gated by an env variable so CI stays green before the deploy; run them locally against production afterwards.

## File structure

**Demo app (`examples/chat/angular/src/app/stage/`)**
- Modify `stage-bridge.ts` — `StageReady` gains `hold` and `reloadEndMs` (the parent needs the hold's numbers for the approve mapping and the reload boundary for the persist midpoint).
- Modify `stage-mode.component.ts` — posts the two new fields.
- Modify `stage-bridge.spec.ts`, `stage-mode.component.spec.ts` — assert the new payload.

**Website (`apps/website/src/`)**
- Create `vendor/scrollcraft/scrollcraft.js` — the engine, byte-identical to the pinned upstream file; `vendor/scrollcraft/LICENSE`; `vendor/scrollcraft/README.md`; `vendor/scrollcraft/scrollcraft.d.ts` (the `window.ScrollCraft` shape); `vendor/scrollcraft/scrollcraft.spec.ts` (hash pin).
- Create `lib/stage-beats.ts` + `lib/stage-beats.spec.ts` — shares, windows, the piecewise monotonic time map, the hold range, the threshold, cue strings.
- Modify `lib/positioning.ts` + `lib/positioning.spec.ts` — `STAGE_RAIL` (per-beat eyebrow, headline, body, rows, cta, still alt text) and `STAGE_HOLD_LINES`.
- Modify `lib/analytics/events.ts`, `lib/analytics/client.ts` + spec — `marketing:stage_progress`, surface `home_stage`, `trackStageProgress`.
- Create `components/landing/StageStills.tsx` + spec — the server-rendered fallback (four stills + copy).
- Create `components/landing/StageAct.tsx` — the pinned act: frame + rail + publisher (client).
- Create `components/landing/Stage.tsx` + spec — the mode switch (stills by default, act when allowed).
- Create `components/landing/use-stage-publisher.ts` + spec — the rAF publisher and message handler, DOM-only, no React state per frame.
- Modify `app/page.tsx` — `<Stage />` replaces the four `FeatureBlock`s.
- Modify `styles/landing.css` + `styles/style-contracts.spec.ts` — `.stage-*` rules; the sticky contract.
- Modify `eslint.config.mjs` (website) — ignore the vendored engine.

**Website e2e (`apps/website/e2e/`)**
- Create `home-stage.spec.ts`.
- Create `scroll-craft/shoot.mjs` (vendored harness, unmodified), `scroll-craft/verify-home.mjs` (runs the three modes against a running server and fails on dead scroll / cues that never peak), `scroll-craft/README.md`.
- Modify `.github/workflows/ci.yml` — one step in `website-e2e` that builds, starts `next start`, runs `verify-home.mjs`, uploads the contact sheets.

---

### Task 1: The frame tells the parent where the hold and the reload are

**Files:**
- Modify: `examples/chat/angular/src/app/stage/stage-bridge.ts`
- Modify: `examples/chat/angular/src/app/stage/stage-mode.component.ts` (the `postReady` call, ~line 368)
- Test: `examples/chat/angular/src/app/stage/stage-bridge.spec.ts`, `stage-mode.component.spec.ts`

- [ ] **Step 1: Failing test — the bridge posts `hold` and `reloadEndMs`**

Add to `stage-bridge.spec.ts`, next to the existing `postReady` case:

```ts
it('postReady carries the hold and the reload boundary the parent maps scroll through', () => {
  const posted: unknown[] = [];
  const parent = { postMessage: (m: unknown) => posted.push(m) } as unknown as Window;
  const self = { addEventListener: () => undefined, removeEventListener: () => undefined } as unknown as Window;
  const bridge = createStageBridge({ referrer: 'https://threadplane.ai/', parent, self });
  bridge.postReady({
    totalMs: 9000,
    beats: [{ beat: 'stream', startMs: 0, endMs: 1000 }],
    hold: { startMs: 5000, endMs: 8000 },
    reloadEndMs: 1600,
  });
  expect(posted[0]).toMatchObject({ type: STAGE_MESSAGE_TYPE, ready: true, hold: { startMs: 5000, endMs: 8000 }, reloadEndMs: 1600 });
});
```

- [ ] **Step 2: Run** `cd examples/chat/angular && npx vitest run src/app/stage/stage-bridge` — FAIL (type error / missing fields).

- [ ] **Step 3: Implement**

In `stage-bridge.ts`:

```ts
export interface StageReady {
  totalMs: number;
  beats: readonly TimelineBeat[];
  /** The authored hold at the interrupt (timeline ms). */
  hold: { readonly startMs: number; readonly endMs: number };
  /** End of the persist beat's reload run, or null when the recording has none. */
  reloadEndMs: number | null;
}
```
and in `postReady`: `post({ ready: true, totalMs: ready.totalMs, beats: ready.beats, hold: ready.hold, reloadEndMs: ready.reloadEndMs });`

In `stage-mode.component.ts`, where `postReady` is called:

```ts
const reload = tl.runs.find((r) => r.run.action.kind === 'reload');
this.bridge.postReady({
  totalMs: tl.totalMs,
  beats: tl.beats,
  hold: tl.hold,
  reloadEndMs: reload ? reload.endMs : null,
});
```

- [ ] **Step 4: Component spec** — find the existing `postReady` assertion in `stage-mode.component.spec.ts` and extend it: `expect(ready.hold).toEqual(timeline.hold)` and `expect(ready.reloadEndMs).toBe(timeline.runs[1].endMs)` (the fixture's run 1 is the reload; check `stage-recording.fixtures.ts`'s `MINIMAL`).

- [ ] **Step 5: Run** `npx vitest run src/app/stage` — PASS. `npx eslint examples/chat/angular/src/app/stage` — clean.

- [ ] **Step 6: Commit** `feat(examples/chat): stage ready message carries the hold and the reload boundary`

---

### Task 2: Vendor the engine

**Files:**
- Create: `apps/website/src/vendor/scrollcraft/scrollcraft.js`, `LICENSE`, `README.md`, `scrollcraft.d.ts`, `scrollcraft.spec.ts`
- Modify: `apps/website/eslint.config.mjs`

- [ ] **Step 1: Copy the pinned files**

```bash
git clone --quiet https://github.com/nateherkai/scroll-craft /tmp/scroll-craft-pin && git -C /tmp/scroll-craft-pin checkout --quiet 0b81622
mkdir -p apps/website/src/vendor/scrollcraft
cp /tmp/scroll-craft-pin/plugins/nateherk-design/skills/scroll-craft/engine/scrollcraft.js apps/website/src/vendor/scrollcraft/scrollcraft.js
cp /tmp/scroll-craft-pin/LICENSE apps/website/src/vendor/scrollcraft/LICENSE
shasum -a 256 apps/website/src/vendor/scrollcraft/scrollcraft.js
```
(Use the scratchpad directory instead of `/tmp` when one is listed in your environment.) Record the printed hash; it goes into the spec below.

- [ ] **Step 2: README**

`apps/website/src/vendor/scrollcraft/README.md`:

```md
# scroll-craft engine (vendored)

Source: https://github.com/nateherkai/scroll-craft — `plugins/nateherk-design/skills/scroll-craft/engine/scrollcraft.js`
Commit: 0b81622 (2026-09-04). Licence: MIT (LICENSE beside this file).

`scrollcraft.js` is byte-identical to upstream and MUST stay that way — `scrollcraft.spec.ts` pins its SHA-256. Upstream's CSS is deliberately not vendored: the few rules the homepage needs (`.stage-pin` sticky, `[data-sc-cue]` initial opacity) live in `src/styles/landing.css` under the website's own style contract.

To update: copy the new file, re-run `shasum -a 256`, update the hash in the spec and the commit here.
```

- [ ] **Step 3: Type declaration** `scrollcraft.d.ts`:

```ts
/** The globals `scrollcraft.js` installs. Only what the homepage uses. */
export interface ScrollCraftAct {
  el: HTMLElement;
  device: 'scrub' | 'pin' | 'pan' | 'flow';
  p: number;
}
export interface ScrollCraftInstance {
  layout(): void;
  acts: ScrollCraftAct[];
  lerp: number;
}
export interface ScrollCraftGlobal {
  mount(root?: Element | Document | string, opts?: { lerp?: number }): ScrollCraftInstance;
  reduce: boolean;
  instances: ScrollCraftInstance[];
}
declare global {
  interface Window { ScrollCraft?: ScrollCraftGlobal }
}
```

- [ ] **Step 4: Hash pin spec** `scrollcraft.spec.ts`:

```ts
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Upstream commit 0b81622. See README.md beside this file before changing. */
const PINNED_SHA256 = '<hash from Step 1>';

describe('vendored scroll-craft engine', () => {
  it('is byte-identical to the pinned upstream file', () => {
    const src = readFileSync(join(__dirname, 'scrollcraft.js'));
    expect(createHash('sha256').update(src).digest('hex')).toBe(PINNED_SHA256);
  });
  it('exposes mount and never auto-mounts', () => {
    const src = readFileSync(join(__dirname, 'scrollcraft.js'), 'utf8');
    expect(src).toMatch(/global\.ScrollCraft = \{ mount: mount/);
    expect(src).not.toMatch(/DOMContentLoaded/);
  });
});
```

- [ ] **Step 5: ESLint ignore** — in `apps/website/eslint.config.mjs` add `'src/vendor/scrollcraft/scrollcraft.js'` to the `ignores` array (create the `{ ignores: [...] }` entry if the config has none). Confirm with `npx eslint apps/website/src/vendor/scrollcraft` → no output.

- [ ] **Step 6: Run** `npx nx test website -- src/vendor/scrollcraft` — PASS (check the Vitest include glob in `apps/website/vitest.config.*` covers `src/**/*.spec.ts`; it does for `src/lib` and `src/components`; if `src/vendor` is excluded, add it).

- [ ] **Step 7: Commit** `chore(website): vendor the scroll-craft engine, pinned at 0b81622`

---

### Task 3: The beat map

**Files:**
- Create: `apps/website/src/lib/stage-beats.ts`, `apps/website/src/lib/stage-beats.spec.ts`

- [ ] **Step 1: Failing tests**

```ts
// apps/website/src/lib/stage-beats.spec.ts
import { describe, expect, it } from 'vitest';
import {
  APPROVE_HOLD, STAGE_BEATS, STAGE_SPAN, beatAt, beatWindows, crossedThreshold, cueFor, inHold, timeAt,
  type StageReadyMessage,
} from './stage-beats';

const READY: StageReadyMessage = {
  totalMs: 40_000,
  beats: [
    { beat: 'stream', startMs: 0, endMs: 12_000 },
    { beat: 'persist', startMs: 12_000, endMs: 20_000 },
    { beat: 'approve', startMs: 20_000, endMs: 32_000 },
    { beat: 'render', startMs: 32_000, endMs: 40_000 },
  ],
  hold: { startMs: 27_000, endMs: 30_000 },
  reloadEndMs: 12_600,
};

describe('beatWindows', () => {
  it('partitions the act by the shares, in beat order, summing to the span', () => {
    const w = beatWindows();
    expect(w.map((x) => x.beat)).toEqual([...STAGE_BEATS]);
    expect(w[0].from).toBe(0);
    expect(w[w.length - 1].to).toBe(1);
    w.slice(1).forEach((x, i) => expect(x.from).toBe(w[i].to));
    expect(STAGE_SPAN).toBe(6);
  });
});

describe('timeAt', () => {
  it('is monotonic non-decreasing across the whole act', () => {
    let last = -1;
    for (let i = 0; i <= 2000; i++) {
      const t = timeAt(i / 2000, READY);
      expect(t).toBeGreaterThanOrEqual(last);
      last = t;
    }
  });
  it('lands each beat boundary on the recording boundary', () => {
    const w = beatWindows();
    w.forEach((x, i) => expect(timeAt(x.from, READY)).toBe(READY.beats[i].startMs));
    expect(timeAt(1, READY)).toBe(READY.totalMs);
  });
  it('settles the reload at the persist midpoint', () => {
    const persist = beatWindows()[1];
    expect(timeAt((persist.from + persist.to) / 2, READY)).toBe(READY.reloadEndMs);
  });
  it('pins time at the interrupt through the hold and resumes past the threshold', () => {
    const a = beatWindows()[2];
    const at = (f: number) => timeAt(a.from + (a.to - a.from) * f, READY);
    expect(at(APPROVE_HOLD.from)).toBe(READY.hold.startMs);
    expect(at(0.5)).toBe(READY.hold.startMs);
    expect(at(APPROVE_HOLD.to - 1e-6)).toBe(READY.hold.startMs);
    expect(at(APPROVE_HOLD.to)).toBe(READY.hold.endMs);
    expect(at(1)).toBe(READY.beats[2].endMs);
  });
  it('holds the mounted form through the render tail', () => {
    const r = beatWindows()[3];
    expect(timeAt(r.from + (r.to - r.from) * 0.9, READY)).toBe(READY.totalMs);
  });
  it('clamps outside 0..1 and falls back to linear persist without a reload', () => {
    expect(timeAt(-1, READY)).toBe(0);
    expect(timeAt(2, READY)).toBe(READY.totalMs);
    const noReload = { ...READY, reloadEndMs: null };
    const persist = beatWindows()[1];
    expect(timeAt((persist.from + persist.to) / 2, noReload)).toBe(16_000);
  });
});

describe('inHold / beatAt / crossedThreshold', () => {
  it('reports the hold only inside the approve hold range', () => {
    const a = beatWindows()[2];
    expect(inHold(a.from + (a.to - a.from) * 0.5)).toBe(true);
    expect(inHold(a.from + (a.to - a.from) * 0.2)).toBe(false);
    expect(inHold(0)).toBe(false);
  });
  it('names the beat at a progress', () => {
    expect(beatAt(0)).toBe('stream');
    expect(beatAt(0.999)).toBe('render');
  });
  it('fires the threshold exactly once per crossing, forwards only', () => {
    const a = beatWindows()[2];
    const th = a.from + (a.to - a.from) * APPROVE_HOLD.to;
    expect(crossedThreshold(th - 0.01, th + 0.01)).toBe(true);
    expect(crossedThreshold(th + 0.01, th - 0.01)).toBe(false);
    expect(crossedThreshold(th + 0.01, th + 0.02)).toBe(false);
  });
});

describe('cueFor', () => {
  it('greets on the first beat, holds on the last, and fades the middle ones', () => {
    expect(cueFor('stream')).toMatch(/^0 0\.21\d+ 0 0\.3$/);
    expect(cueFor('render')).toMatch(/ 1 0\.3 0$/);
    expect(cueFor('persist').split(' ')).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run** `npx nx test website -- src/lib/stage-beats` — FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
// apps/website/src/lib/stage-beats.ts
/**
 * Scroll → recorded time for the homepage stage (spec §5.2, §6).
 *
 * The shares are authored; the times come from the frame's `ready` message,
 * so the rail's cue windows (derived from the shares) and the seek targets
 * (derived from the recording) are two views of one table.
 */
export const STAGE_BEATS = ['stream', 'persist', 'approve', 'render'] as const;
export type StageBeat = (typeof STAGE_BEATS)[number];

/** Viewport-heights of scroll each beat owns. Approve is the peak by a visible margin. */
export const STAGE_SHARES: Readonly<Record<StageBeat, number>> = { stream: 1.3, persist: 1.2, approve: 2.4, render: 1.1 };
export const STAGE_SPAN = Object.values(STAGE_SHARES).reduce((a, b) => a + b, 0);
/** Fractions of the approve beat: linear → hold → threshold and resume. */
export const APPROVE_HOLD = { from: 0.35, to: 0.7 } as const;
/** The last slice of the render beat holds on the mounted form. */
export const RENDER_TAIL = 0.15;

export interface StageReadyMessage {
  totalMs: number;
  beats: readonly { beat: StageBeat; startMs: number; endMs: number }[];
  hold: { startMs: number; endMs: number };
  reloadEndMs: number | null;
}

export interface BeatWindow { beat: StageBeat; from: number; to: number }

export function beatWindows(): BeatWindow[] {
  let acc = 0;
  return STAGE_BEATS.map((beat) => {
    const from = acc / STAGE_SPAN;
    acc += STAGE_SHARES[beat];
    return { beat, from, to: acc / STAGE_SPAN };
  });
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a: number, b: number, f: number) => a + (b - a) * f;

export function beatAt(p: number): StageBeat {
  const q = clamp01(p);
  const w = beatWindows().find((x) => q < x.to) ?? beatWindows()[STAGE_BEATS.length - 1];
  return w.beat;
}

/** Progress within the beat that owns `p`, 0..1. */
function local(p: number): { beat: StageBeat; f: number } {
  const q = clamp01(p);
  const w = beatWindows().find((x) => q < x.to) ?? beatWindows()[STAGE_BEATS.length - 1];
  return { beat: w.beat, f: clamp01((q - w.from) / (w.to - w.from)) };
}

export function inHold(p: number): boolean {
  const { beat, f } = local(p);
  return beat === 'approve' && f >= APPROVE_HOLD.from && f < APPROVE_HOLD.to;
}

/** True when scroll moved forward across the approve threshold between two frames. */
export function crossedThreshold(prevP: number, nextP: number): boolean {
  const a = beatWindows()[2];
  const th = a.from + (a.to - a.from) * APPROVE_HOLD.to;
  return prevP < th && nextP >= th;
}

/** Piecewise monotonic: recorded milliseconds at act progress `p`. */
export function timeAt(p: number, ready: StageReadyMessage): number {
  if (p >= 1) return ready.totalMs;
  const { beat, f } = local(p);
  const b = ready.beats.find((x) => x.beat === beat);
  if (!b) return 0;
  switch (beat) {
    case 'persist': {
      const mid = ready.reloadEndMs;
      if (mid === null) return Math.round(lerp(b.startMs, b.endMs, f));
      return f < 0.5 ? Math.round(lerp(b.startMs, mid, f / 0.5)) : Math.round(lerp(mid, b.endMs, (f - 0.5) / 0.5));
    }
    case 'approve': {
      if (f < APPROVE_HOLD.from) return Math.round(lerp(b.startMs, ready.hold.startMs, f / APPROVE_HOLD.from));
      if (f < APPROVE_HOLD.to) return ready.hold.startMs;
      return Math.round(lerp(ready.hold.endMs, b.endMs, (f - APPROVE_HOLD.to) / (1 - APPROVE_HOLD.to)));
    }
    case 'render': {
      const live = 1 - RENDER_TAIL;
      return f >= live ? ready.totalMs : Math.round(lerp(b.startMs, ready.totalMs, f / live));
    }
    default:
      return Math.round(lerp(b.startMs, b.endMs, f));
  }
}

/**
 * `data-sc-cue` for a beat's rail block: "from to rampIn rampOut" as fractions
 * of act progress. The first beat greets (full at p = 0), the last holds to
 * the end (no leave ramp), the middle ones fade in and out inside their window.
 */
export function cueFor(beat: StageBeat): string {
  const w = beatWindows().find((x) => x.beat === beat)!;
  const fmt = (n: number) => String(+n.toFixed(4));
  if (beat === STAGE_BEATS[0]) return `0 ${fmt(w.to)} 0 0.3`;
  if (beat === STAGE_BEATS[STAGE_BEATS.length - 1]) return `${fmt(w.from)} 1 0.3 0`;
  return `${fmt(w.from)} ${fmt(w.to)}`;
}

/** Cue windows for the three hold lines inside the approve beat, spread across the hold range. */
export function holdLineCues(count: number): string[] {
  const a = beatWindows()[2];
  const span = a.to - a.from;
  const start = a.from + span * APPROVE_HOLD.from;
  const end = a.from + span * APPROVE_HOLD.to;
  const slot = (end - start) / count;
  return Array.from({ length: count }, (_, i) => {
    const from = start + slot * i;
    const to = i === count - 1 ? end + span * 0.12 : from + slot * 1.15;
    return `${+from.toFixed(4)} ${+Math.min(to, 1).toFixed(4)}`;
  });
}
```

Note on `timeAt` inside the approve hold: the recording's timeline has a 3,000 ms authored hold (`HOLD_MS`) between the approve run and the resume run; the parent pins `t` at `hold.startMs` for the whole 35–70% range and jumps to `hold.endMs` at 70%. The frame's `phaseAt` reports `pause` for any `t` inside `[hold.startMs, hold.endMs)`, so the devtools show the interrupt through the hold, and `resume` from the threshold.

- [ ] **Step 4: Run** the spec — PASS. Add a `holdLineCues` case: three cues, each `from` strictly increasing, all inside `[approve.from, 1]`.

- [ ] **Step 5: Commit** `feat(website): stage beat map — shares, the hold, the threshold, cue windows`

---

### Task 4: Rail copy in positioning.ts

**Files:**
- Modify: `apps/website/src/lib/positioning.ts`, `apps/website/src/lib/positioning.spec.ts`

- [ ] **Step 1: Failing test**

```ts
describe('STAGE_RAIL', () => {
  it('has one entry per beat in beat order, three rows each, a cta, and still alt text', () => {
    expect(STAGE_RAIL.map((b) => b.beat)).toEqual(['stream', 'persist', 'approve', 'render']);
    for (const b of STAGE_RAIL) {
      expect(b.rows).toHaveLength(3);
      expect(b.cta.href).toMatch(/^\//);
      expect(b.stillAlt.length).toBeGreaterThan(40);
    }
  });
  it('carries the three hold lines from the spec, ending on the threshold instruction', () => {
    expect(STAGE_HOLD_LINES).toHaveLength(3);
    expect(STAGE_HOLD_LINES[2]).toBe('Keep scrolling to approve');
  });
});
```

- [ ] **Step 2: Implement** — add to `positioning.ts` (copy the strings verbatim from the four `FeatureBlock`s in `app/page.tsx`; the `body` strings that contain `<code>` become plain text with the API names inline):

```ts
export type StageBeatKey = 'stream' | 'persist' | 'approve' | 'render';
export interface StageRailBeat {
  beat: StageBeatKey;
  eyebrow: string;
  headline: string;
  body: string;
  rows: readonly { claim: string; api: string }[];
  cta: { label: string; href: string };
  /** Alt text for the fallback still: what the frame shows at this beat's settle. */
  stillAlt: string;
}

export const STAGE_RAIL: readonly StageRailBeat[] = [
  {
    beat: 'stream',
    eyebrow: 'Stream',
    headline: 'The UI stays reactive through tokens, tools, errors, and state changes.',
    body: 'injectAgent() hands back signals: messages(), status(), error(), isLoading(), and tool progress. Nothing to subscribe to, nothing to tear down.',
    rows: [
      { claim: 'Signals, not promises', api: 'injectAgent()' },
      { claim: 'Tool progress as it happens', api: 'toolProgress()' },
      { claim: 'Same contract on LangGraph and AG-UI', api: 'Agent' },
    ],
    cta: { label: 'Read the streaming guide', href: '/docs/langgraph/guides/streaming' },
    stillAlt: 'Threadplane chat beside its devtools: a streamed answer about Angular signals with a Sources row of citations, and the devtools Timeline listing seven checkpoints',
  },
  {
    beat: 'persist',
    eyebrow: 'Persist',
    headline: 'A user can leave, return, inspect history, and continue.',
    body: 'Thread selection, history, branch and replay UI in the Angular app. Durability itself comes from the runtime and persistence layer you connect — Threadplane exposes it, it does not fake it.',
    rows: [
      { claim: 'Conversations restore across sessions', api: 'threadId + checkpoints' },
      { claim: 'Branch or replay from any point', api: 'branch / replay' },
      { claim: 'error() / status() / reload() on every agent', api: 'boundary signals' },
    ],
    cta: { label: 'Persistence patterns', href: '/docs/langgraph/guides/persistence' },
    stillAlt: 'The thread restored after a reload and forked from an earlier checkpoint: a "Make it a haiku instead." turn, with the devtools Timeline showing ten checkpoints and the fork',
  },
  {
    beat: 'approve',
    eyebrow: 'Approve',
    headline: 'Irreversible work pauses for a human decision.',
    body: 'interrupt() freezes the run inside the checkpoint. Your UI renders the proposal; submit({ resume }) continues with the decision on the record.',
    rows: [
      { claim: 'The pause is a checkpoint, not a modal', api: 'interrupt()' },
      { claim: 'The proposal renders in your UI', api: '<chat-interrupt-panel>' },
      { claim: 'The decision lands beside the action it gated', api: 'submit({ resume })' },
    ],
    cta: { label: 'Interrupt patterns', href: '/docs/langgraph/guides/interrupts' },
    stillAlt: 'The agent paused inside delete_backups: the interrupt panel with Accept, Edit, Respond and Ignore above a five-row table of the backups it would delete, and the devtools State tab showing the interrupt',
  },
  {
    beat: 'render',
    eyebrow: 'Render',
    headline: 'Agent output becomes components from your design system.',
    body: 'The agent emits constrained structured output. Angular renders registered components — json-render and A2UI both speak it — with per-component fallback and a readiness gate. No generated code runs.',
    rows: [
      { claim: 'Your design system, not a chat widget', api: '@threadplane/render' },
      { claim: 'Unknown specs degrade per component', api: 'fallback + readiness gate' },
      { claim: 'Schema on the server, trust in the client', api: 'validated specs' },
    ],
    cta: { label: 'See @threadplane/render', href: '/render' },
    stillAlt: 'A generated contact form — Name, Email, Subject, Message and a Send button — rendered from the agent\'s A2UI output inside the chat, with the render_a2ui_surface tool call above it',
  },
];

/** Spec §6: the copy that advances while recorded time is pinned at the interrupt. */
export const STAGE_HOLD_LINES: readonly string[] = [
  'The pause is a checkpoint, not a modal',
  'The run is frozen in durable state. Scroll all you like; nothing happens until someone decides',
  'Keep scrolling to approve',
];
```

- [ ] **Step 3: Run** `npx nx test website -- src/lib/positioning src/lib/public-copy` — PASS (the public-copy unit scan must stay green with the new strings).

- [ ] **Step 4: Commit** `feat(website): stage rail copy single-sourced in positioning.ts`

---

### Task 5: The stills fallback

**Files:**
- Create: `apps/website/src/components/landing/StageStills.tsx`, `StageStills.spec.tsx`
- Modify: `apps/website/src/styles/landing.css`

- [ ] **Step 1: Failing test**

```tsx
// StageStills.spec.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StageStills } from './StageStills';
import { STAGE_RAIL } from '../../lib/positioning';

describe('StageStills', () => {
  it('renders four beats in order, each with its still, phone source, copy rows and cta', () => {
    render(<StageStills />);
    const beats = screen.getAllByTestId('stage-still-beat');
    expect(beats.map((b) => b.getAttribute('data-beat'))).toEqual(['stream', 'persist', 'approve', 'render']);
    for (const [i, b] of beats.entries()) {
      const img = b.querySelector('img')!;
      expect(img.getAttribute('src')).toBe(`/screenshots/stage-${STAGE_RAIL[i].beat}.webp`);
      expect(img.getAttribute('alt')).toBe(STAGE_RAIL[i].stillAlt);
      expect(img.getAttribute('loading')).toBe('lazy');
      expect(b.querySelector('source')!.getAttribute('srcset')).toBe(`/screenshots/stage-${STAGE_RAIL[i].beat}-mobile.webp`);
      expect(b.querySelectorAll('.feature-block-row')).toHaveLength(3);
      expect(b.querySelector('a.feature-block-cta')!.getAttribute('href')).toBe(STAGE_RAIL[i].cta.href);
    }
  });
  it('is the section the act replaces, with its anchors', () => {
    render(<StageStills />);
    expect(document.querySelector('section#stage')).not.toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: STAGE_RAIL[2].headline })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement**

```tsx
// StageStills.tsx  (server component — no 'use client')
import Link from 'next/link';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import { STAGE_RAIL } from '../../lib/positioning';

export const STAGE_STILL_MOBILE_MEDIA = '(max-width: 767px)';
const STILL_W = 1200, STILL_H = 720, STILL_MOBILE_W = 585, STILL_MOBILE_H = 975;

/**
 * The stage's non-pinned form (spec §8): the same four beats as four stacked
 * stills from `/stage`, each with its rail copy. Server-rendered by default;
 * `Stage` swaps in the pinned act on wide, motion-tolerant viewports.
 */
export function StageStills() {
  return (
    <Section id="stage" surface="canvas" ariaLabelledBy="stage-heading">
      <Container>
        <h2 id="stage-heading" className="sr-only">One real run: stream, persist, approve, render</h2>
        <div className="stage-stills">
          {STAGE_RAIL.map((b) => (
            <article className="stage-still" data-testid="stage-still-beat" data-beat={b.beat} key={b.beat}>
              <div className="stage-still-visual">
                <picture>
                  <source media={STAGE_STILL_MOBILE_MEDIA} srcSet={`/screenshots/stage-${b.beat}-mobile.webp`} width={STILL_MOBILE_W} height={STILL_MOBILE_H} />
                  <img src={`/screenshots/stage-${b.beat}.webp`} width={STILL_W} height={STILL_H} alt={b.stillAlt} loading="lazy" decoding="async" className="stage-still-img" />
                </picture>
              </div>
              <div className="feature-block-text">
                <div className="feature-block-rail">
                  <Eyebrow tone="accent" className="feature-block-eyebrow">{b.eyebrow}</Eyebrow>
                  <span className="feature-block-rail-line" aria-hidden="true" />
                </div>
                <h3 className="feature-block-heading">{b.headline}</h3>
                <p className="feature-block-body">{b.body}</p>
                <div className="feature-block-rows">
                  {b.rows.map((row) => (
                    <div className="feature-block-row" key={row.claim}>
                      <span className="feature-block-row-claim">{row.claim}</span>
                      <span className="feature-block-row-api">{row.api}</span>
                    </div>
                  ))}
                </div>
                <Link href={b.cta.href} className="feature-block-cta">{b.cta.label} →</Link>
              </div>
            </article>
          ))}
        </div>
      </Container>
    </Section>
  );
}
```

The second spec case uses `getByRole('heading', { level: 2 ...})` — change it to level 3 to match the markup above (the h2 is the visually hidden section heading; check the site has an `.sr-only` utility in `ui.css`; if not, use the existing visually-hidden class the header uses, found with `grep -rn "clip: rect" apps/website/src/styles`).

- [ ] **Step 3: CSS** — append to `landing.css`, after the `.reliability-*` block:

```css
/* Stage — components/landing/Stage.tsx, StageStills.tsx, StageAct.tsx
 * The stills are the section's default form; the pinned act replaces them on
 * wide, motion-tolerant viewports after hydration. The stills reuse the
 * feature-block row grammar so the two forms read as one section. */
.stage-stills { display: grid; gap: 96px; }
.stage-still { display: grid; grid-template-columns: 3fr 2fr; gap: 48px; align-items: center; }
.stage-still:nth-child(even) .stage-still-visual { order: 2; }
.stage-still-visual { border-radius: 12px; overflow: hidden; background: #0f1116; }
.stage-still-visual picture { display: block; }
.stage-still-img { display: block; width: 100%; height: auto; }
@media (max-width: 900px) {
  .stage-still { grid-template-columns: 1fr; gap: 24px; }
  .stage-still:nth-child(even) .stage-still-visual { order: 0; }
  .stage-stills { gap: 64px; }
}
```

- [ ] **Step 4: Run** `npx nx test website -- StageStills` — PASS. `npx eslint apps/website/src/components/landing/StageStills.tsx` — clean.

- [ ] **Step 5: Commit** `feat(website): stage stills — the section's server-rendered form`

---

### Task 6: The publisher

**Files:**
- Create: `apps/website/src/components/landing/use-stage-publisher.ts`, `use-stage-publisher.spec.ts`

The publisher is DOM-only: it never sets React state per frame. It owns the rAF loop, the `--sc-p` read, the beat map, the postMessage, the verify attributes, and the analytics milestones.

- [ ] **Step 1: Failing tests**

```ts
// use-stage-publisher.spec.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStagePublisher, STAGE_DEMO_ORIGIN, STAGE_MESSAGE_TYPE } from './use-stage-publisher';
import { beatWindows, APPROVE_HOLD } from '../../lib/stage-beats';

const READY = {
  type: STAGE_MESSAGE_TYPE, ready: true, totalMs: 40_000,
  beats: [
    { beat: 'stream', startMs: 0, endMs: 12_000 }, { beat: 'persist', startMs: 12_000, endMs: 20_000 },
    { beat: 'approve', startMs: 20_000, endMs: 32_000 }, { beat: 'render', startMs: 32_000, endMs: 40_000 },
  ],
  hold: { startMs: 27_000, endMs: 30_000 }, reloadEndMs: 12_600,
};

function setup() {
  const section = document.createElement('section');
  document.body.appendChild(section);
  const posted: unknown[] = [];
  const frame = { postMessage: (m: unknown, origin: string) => posted.push({ m, origin }) } as unknown as Window;
  const track = vi.fn();
  const pub = createStagePublisher({ section, frameWindow: () => frame, track });
  // Simulate the frame's ready message
  window.dispatchEvent(new MessageEvent('message', { origin: STAGE_DEMO_ORIGIN, data: READY }));
  return { section, posted, track, pub };
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ''; });

describe('stage publisher', () => {
  it('posts t only when it changes, to the demo origin', () => {
    const { section, posted, pub } = setup();
    section.style.setProperty('--sc-p', '0.1');
    pub.tick(); pub.tick();
    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({ origin: STAGE_DEMO_ORIGIN, m: { type: STAGE_MESSAGE_TYPE, t: expect.any(Number) } });
    section.style.setProperty('--sc-p', '0.2');
    pub.tick();
    expect(posted).toHaveLength(2);
  });
  it('posts nothing before ready', () => {
    const section = document.createElement('section');
    const posted: unknown[] = [];
    const pub = createStagePublisher({ section, frameWindow: () => ({ postMessage: (m: unknown) => posted.push(m) } as unknown as Window), track: vi.fn() });
    section.style.setProperty('--sc-p', '0.3');
    pub.tick();
    expect(posted).toHaveLength(0);
  });
  it('ignores messages from other origins', () => {
    const { section, pub } = setup();
    window.dispatchEvent(new MessageEvent('message', { origin: 'https://evil.example', data: { type: STAGE_MESSAGE_TYPE, applied: 9, phase: 'render', t: 1 } }));
    expect(section.getAttribute('data-sc-verify-state')).toBeNull();
    pub.dispose();
  });
  it('mirrors the frame\'s applied state into data-sc-verify-state and the hold into data-sc-verify-hold', () => {
    const { section, pub } = setup();
    window.dispatchEvent(new MessageEvent('message', { origin: STAGE_DEMO_ORIGIN, data: { type: STAGE_MESSAGE_TYPE, applied: 42, phase: 'stream', t: 900 } }));
    expect(section.getAttribute('data-sc-verify-state')).toBe('stream:42');
    const a = beatWindows()[2];
    section.style.setProperty('--sc-p', String(a.from + (a.to - a.from) * 0.5));
    pub.tick();
    expect(section.getAttribute('data-sc-verify-hold')).toBe('true');
    section.style.setProperty('--sc-p', String(a.from + (a.to - a.from) * 0.9));
    pub.tick();
    expect(section.getAttribute('data-sc-verify-hold')).toBeNull();
  });
  it('tracks enter once, each beat once, the threshold once, complete once', () => {
    const { section, track, pub } = setup();
    const a = beatWindows()[2];
    const th = a.from + (a.to - a.from) * APPROVE_HOLD.to;
    for (const p of [0.01, 0.02, beatWindows()[1].from + 0.01, th - 0.01, th + 0.01, th + 0.02, 0.999, 1]) {
      section.style.setProperty('--sc-p', String(p));
      pub.tick();
    }
    const events = track.mock.calls.map((c) => `${c[0]}${c[1] ? ':' + c[1] : ''}`);
    expect(events).toEqual(['enter', 'beat:stream', 'beat:persist', 'beat:approve', 'threshold', 'beat:render', 'complete']);
  });
  it('dispose removes the listener and stops posting', () => {
    const { section, posted, pub } = setup();
    pub.dispose();
    section.style.setProperty('--sc-p', '0.5');
    pub.tick();
    expect(posted).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run** — FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
// use-stage-publisher.ts
import { useEffect } from 'react';
import { beatAt, crossedThreshold, inHold, timeAt, type StageBeat, type StageReadyMessage } from '../../lib/stage-beats';

export const STAGE_DEMO_ORIGIN = 'https://demo.threadplane.ai';
export const STAGE_DEMO_URL = `${STAGE_DEMO_ORIGIN}/stage?t=0`;
export const STAGE_MESSAGE_TYPE = 'tplane-stage';

export type StageMilestone = 'enter' | 'beat' | 'threshold' | 'complete';

export interface StagePublisherDeps {
  section: HTMLElement;
  /** The iframe's window, or null while it is not mounted / not navigated. */
  frameWindow: () => Window | null;
  track: (milestone: StageMilestone, beat?: StageBeat) => void;
  /** Called with the frame's first `ready`; the act uses it to crossfade the poster. */
  onReady?: () => void;
}

export interface StagePublisher {
  /** One frame: read --sc-p, post t if it changed, update verify attributes and milestones. */
  tick(): void;
  dispose(): void;
}

function readProgress(el: HTMLElement): number {
  const v = parseFloat(el.style.getPropertyValue('--sc-p'));
  return Number.isFinite(v) ? v : 0;
}

export function createStagePublisher(deps: StagePublisherDeps): StagePublisher {
  let ready: StageReadyMessage | null = null;
  let lastT = -1;
  let lastP = -1;
  let hold = false;
  let entered = false;
  let completed = false;
  let thresholdSeen = false;
  const beatsSeen = new Set<StageBeat>();
  let disposed = false;

  const onMessage = (e: MessageEvent) => {
    if (e.origin !== STAGE_DEMO_ORIGIN) return;
    const d = e.data as Record<string, unknown> | null;
    if (!d || d['type'] !== STAGE_MESSAGE_TYPE) return;
    if (d['ready'] === true && Array.isArray(d['beats']) && typeof d['totalMs'] === 'number') {
      const first = ready === null;
      ready = d as unknown as StageReadyMessage;
      lastT = -1; // re-post the current t after a (re)ready
      if (first) deps.onReady?.();
      return;
    }
    if (typeof d['applied'] === 'number' && typeof d['phase'] === 'string') {
      deps.section.setAttribute('data-sc-verify-state', `${d['phase']}:${d['applied']}`);
    }
  };
  window.addEventListener('message', onMessage);

  return {
    tick() {
      if (disposed) return;
      const p = readProgress(deps.section);
      // Verify hold, from scroll alone: the harness must see the authored hold even before the frame answers.
      const h = inHold(p);
      if (h !== hold) {
        hold = h;
        if (h) deps.section.setAttribute('data-sc-verify-hold', 'true');
        else deps.section.removeAttribute('data-sc-verify-hold');
      }
      // Milestones.
      if (!entered && p > 0) { entered = true; deps.track('enter'); }
      const beat = beatAt(p);
      if (p > 0 && !beatsSeen.has(beat)) { beatsSeen.add(beat); deps.track('beat', beat); }
      if (lastP >= 0 && !thresholdSeen && crossedThreshold(lastP, p)) { thresholdSeen = true; deps.track('threshold'); }
      if (!completed && p >= 0.999) { completed = true; deps.track('complete'); }
      lastP = p;
      // Seek.
      if (!ready) return;
      const t = timeAt(p, ready);
      if (t === lastT) return;
      const w = deps.frameWindow();
      if (!w) return;
      w.postMessage({ type: STAGE_MESSAGE_TYPE, t }, STAGE_DEMO_ORIGIN);
      lastT = t;
    },
    dispose() {
      disposed = true;
      window.removeEventListener('message', onMessage);
    },
  };
}

/**
 * Runs the publisher on animation frames while `active`, and only while the
 * section intersects the viewport (a pinned act six viewports tall is on screen
 * for a while; nothing is posted before it arrives or after it leaves).
 */
export function useStagePublisher(
  sectionRef: React.RefObject<HTMLElement | null>,
  active: boolean,
  deps: Omit<StagePublisherDeps, 'section'>,
): void {
  useEffect(() => {
    const section = sectionRef.current;
    if (!active || !section) return;
    const pub = createStagePublisher({ section, ...deps });
    let onScreen = false;
    let frame = 0;
    const loop = () => {
      pub.tick();
      frame = onScreen ? requestAnimationFrame(loop) : 0;
    };
    const io = new IntersectionObserver((entries) => {
      onScreen = entries.some((e) => e.isIntersecting);
      if (onScreen && frame === 0) frame = requestAnimationFrame(loop);
    });
    io.observe(section);
    return () => {
      io.disconnect();
      onScreen = false;
      if (frame) cancelAnimationFrame(frame);
      pub.dispose();
    };
    // deps are stable callbacks from the act; see StageAct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionRef, active]);
}
```

- [ ] **Step 4: Run** the spec — PASS. Mutation check: comment out `lastT = t;` → the first case fails (posts twice). Restore.

- [ ] **Step 5: Commit** `feat(website): stage publisher — scroll to recorded time, verify attributes, milestones`

---

### Task 7: The act, the frame, the mode switch

**Files:**
- Create: `apps/website/src/components/landing/StageAct.tsx`, `Stage.tsx`, `Stage.spec.tsx`
- Modify: `apps/website/src/styles/landing.css`, `apps/website/src/styles/style-contracts.spec.ts`
- Modify: `apps/website/src/lib/analytics/events.ts`, `client.ts`, `client.spec.ts` (or `server.spec.ts`'s sibling — put the new case where `trackCtaClick` is tested)

- [ ] **Step 1: Analytics (failing test first)**

In the analytics spec that covers `trackCtaClick`, add:

```ts
it('trackStageProgress captures marketing:stage_progress with the milestone and beat', () => {
  trackStageProgress('beat', 'approve');
  expect(captureSpy).toHaveBeenCalledWith('marketing:stage_progress', expect.objectContaining({ surface: 'home_stage', stage_event: 'beat', beat: 'approve' }));
});
```
(Use whatever posthog capture spy the file already sets up.) Then in `events.ts`: add `marketingStageProgress: 'marketing:stage_progress'` to `analyticsEvents`, `'home_stage'` to `AnalyticsSurface`, and to `AnalyticsProperties`: `stage_event?: 'enter' | 'beat' | 'threshold' | 'complete'; beat?: 'stream' | 'persist' | 'approve' | 'render';`. In `client.ts`:

```ts
export function trackStageProgress(stage_event: AnalyticsProperties['stage_event'], beat?: AnalyticsProperties['beat']) {
  track(analyticsEvents.marketingStageProgress, { surface: 'home_stage', stage_event, ...(beat ? { beat } : {}) });
}
```

- [ ] **Step 2: Failing tests for Stage**

```tsx
// Stage.spec.tsx
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Stage } from './Stage';

function mockViewport(width: number, reducedMotion: boolean) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: q.includes('reduce') ? reducedMotion : false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}
afterEach(() => { vi.restoreAllMocks(); });

describe('Stage', () => {
  it('renders the stills on the server and keeps them on a narrow viewport', async () => {
    mockViewport(390, false);
    render(<Stage />);
    expect(screen.getAllByTestId('stage-still-beat')).toHaveLength(4);
    expect(document.querySelector('[data-stage-act]')).toBeNull();
  });
  it('keeps the stills under reduced motion on a wide viewport', () => {
    mockViewport(1440, true);
    render(<Stage />);
    expect(document.querySelector('[data-stage-act]')).toBeNull();
  });
  it('upgrades to the pinned act on a wide, motion-tolerant viewport', async () => {
    mockViewport(1440, false);
    (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = class { observe() {} disconnect() {} } as never;
    render(<Stage />);
    await act(async () => {});
    const actEl = document.querySelector('[data-stage-act]')!;
    expect(actEl.getAttribute('data-sc-act')).toBe('pin');
    expect(actEl.getAttribute('data-sc-span')).toBe('6');
    expect(actEl.querySelector('[data-sc-stage]')).not.toBeNull();
    expect(actEl.querySelectorAll('[data-sc-cue]').length).toBeGreaterThanOrEqual(7); // 4 beats + 3 hold lines
    expect(screen.queryAllByTestId('stage-still-beat')).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Implement `Stage.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { StageStills } from './StageStills';
import { StageAct } from './StageAct';

export const STAGE_MIN_WIDTH = 1024;
type Mode = 'stills' | 'act';

function actAllowed(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.innerWidth < STAGE_MIN_WIDTH) return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Spec §8: the stills are the default (no JS, narrow, reduced motion, frame
 * failure); the pinned act is an upgrade decided after hydration so the server
 * and the first client render agree.
 */
export function Stage() {
  const [mode, setMode] = useState<Mode>('stills');
  useEffect(() => { if (actAllowed()) setMode('act'); }, []);
  if (mode === 'stills') return <StageStills />;
  return <StageAct onFallback={() => setMode('stills')} />;
}
```

- [ ] **Step 4: Implement `StageAct.tsx`**

```tsx
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BrowserFrame } from '../ui/BrowserFrame';
import { Container } from '../ui/Container';
import { Eyebrow } from '../ui/Eyebrow';
import { STAGE_HOLD_LINES, STAGE_RAIL } from '../../lib/positioning';
import { STAGE_SPAN, cueFor, holdLineCues } from '../../lib/stage-beats';
import { trackStageProgress } from '../../lib/analytics/client';
import { STAGE_DEMO_URL, STAGE_MESSAGE_TYPE, STAGE_DEMO_ORIGIN, useStagePublisher, type StageMilestone } from './use-stage-publisher';
import type { StageBeat } from '../../lib/stage-beats';

const READY_TIMEOUT_MS = 8000;
const POSTER = '/screenshots/stage-stream.webp';

interface Props { onFallback: () => void }

/**
 * The pinned act (spec §4.1, §6, §7). The engine owns scroll and `--sc-p`;
 * the publisher turns it into `t`; the iframe is the real `/stage`. Nothing in
 * here sets React state per frame.
 */
export function StageAct({ onFallback }: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [ready, setReady] = useState(false);

  // Mount the engine once the act is in the DOM. The engine is an IIFE that
  // touches window at load, so it is imported on the client only.
  useEffect(() => {
    let cancelled = false;
    void import('../../vendor/scrollcraft/scrollcraft.js').then(() => {
      if (cancelled || !sectionRef.current || !window.ScrollCraft) return;
      // Mount on the act's PARENT: the engine collects acts with
      // root.querySelectorAll('[data-sc-act]'), which matches descendants only.
      window.ScrollCraft.mount(engineRoot(sectionRef.current));
    });
    return () => { cancelled = true; };
  }, []);

  // Ready timeout → the stills.
  useEffect(() => {
    if (ready) return;
    const t = setTimeout(onFallback, READY_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [ready, onFallback]);

  const track = useCallback((m: StageMilestone, beat?: StageBeat) => trackStageProgress(m, beat), []);
  const frameWindow = useCallback(() => (frameLoaded ? iframeRef.current?.contentWindow ?? null : null), [frameLoaded]);
  const onReady = useCallback(() => setReady(true), []);
  useStagePublisher(sectionRef, true, { frameWindow, track, onReady });

  const holdCues = holdLineCues(STAGE_HOLD_LINES.length);

  return (
    <section
      ref={sectionRef}
      id="stage"
      className="stage-act"
      data-stage-act
      data-sc-act="pin"
      data-sc-span={STAGE_SPAN}
      data-state={ready ? 'ready' : 'mounting'}
      aria-labelledby="stage-heading"
    >
      <div className="stage-pin" data-sc-stage>
        <Container className="stage-pin-inner">
          <div className="stage-frame">
            <BrowserFrame url="demo.threadplane.ai/stage" elevation="lg" className="stage-frame-chrome">
              <div className="stage-frame-stage">
                <img src={POSTER} width={1200} height={720} alt="" aria-hidden="true" className="stage-frame-poster" decoding="async" />
                <iframe
                  ref={iframeRef}
                  src={STAGE_DEMO_URL}
                  title="Threadplane stage: a recorded LangGraph run, scrubbed by scroll"
                  className="stage-frame-iframe"
                  tabIndex={-1}
                  onLoad={() => setFrameLoaded(true)}
                />
              </div>
            </BrowserFrame>
            <a className="stage-frame-open" href={STAGE_DEMO_ORIGIN} target="_blank" rel="noopener noreferrer">Open the live demo →</a>
          </div>
          <div className="stage-rail">
            <h2 id="stage-heading" className="sr-only">One real run: stream, persist, approve, render</h2>
            {STAGE_RAIL.map((b) => (
              <div className="stage-rail-beat" data-beat={b.beat} data-sc-cue={cueFor(b.beat)} key={b.beat}>
                <div className="feature-block-rail">
                  <Eyebrow tone="accent" className="feature-block-eyebrow">{b.eyebrow}</Eyebrow>
                  <span className="feature-block-rail-line" aria-hidden="true" />
                </div>
                <h3 className="feature-block-heading stage-rail-heading">{b.headline}</h3>
                <p className="feature-block-body">{b.body}</p>
                <div className="feature-block-rows">
                  {b.rows.map((row) => (
                    <div className="feature-block-row" key={row.claim}>
                      <span className="feature-block-row-claim">{row.claim}</span>
                      <span className="feature-block-row-api">{row.api}</span>
                    </div>
                  ))}
                </div>
                <Link href={b.cta.href} className="feature-block-cta">{b.cta.label} →</Link>
              </div>
            ))}
            {STAGE_HOLD_LINES.map((line, i) => (
              <p className="stage-rail-hold" data-sc-cue={holdCues[i]} key={line}>{line}</p>
            ))}
          </div>
        </Container>
      </div>
    </section>
  );
}
```

Notes for the implementer:
- The rail beats stack in the same grid cell (`grid-area: 1 / 1`) so cues crossfade in place; the hold lines sit in a second cell beneath. See the CSS.
- The engine sets the section's inline height to `span * 100vh` and sticks `[data-sc-stage]`; the CSS below provides the sticky rule the engine checks for (it warns "not sticky" otherwise).
- The section's `id="stage"` is shared by `StageStills`; only one renders at a time.
- `frameWindow` is memoized on `frameLoaded`; the publisher hook re-subscribes when `active` or the ref changes only, and reads `deps` through the closure created at subscribe time — so pass `frameLoaded` through a ref inside the hook instead if the first `ready` arrives before `frameLoaded` flips (it cannot: `ready` is posted by the frame after it has navigated, which is after `load`). Keep the simple version unless the e2e shows a missed first post.

- [ ] **Step 5: CSS** — append to `landing.css`:

```css
/* The pinned act. The engine sets the act's height inline (span × 100vh) and
 * requires the stage to be sticky; it only warns when it is not, so the
 * style-contract spec pins this rule. */
.stage-act { position: relative; }
.stage-pin {
  position: sticky; top: 0;
  height: 100vh; height: 100svh;
  overflow: clip;
  display: flex; align-items: center;
}
.stage-pin-inner { display: grid; grid-template-columns: 3fr 2fr; gap: 48px; align-items: center; width: 100%; }
.stage-frame { display: grid; gap: 12px; }
.stage-frame-stage { position: relative; aspect-ratio: 1200 / 720; background: #0f1116; }
.stage-frame-poster { position: absolute; inset: 0; width: 100%; height: 100%; display: block; transition: opacity 300ms ease; }
.stage-frame-iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; opacity: 0; transition: opacity 300ms ease; pointer-events: none; }
.stage-act[data-state='ready'] .stage-frame-iframe { opacity: 1; }
.stage-act[data-state='ready'] .stage-frame-poster { opacity: 0; }
.stage-frame-open { font-size: 13px; justify-self: end; }
.stage-rail { display: grid; grid-template-rows: auto auto; align-content: center; min-height: 60vh; }
.stage-rail-beat { grid-area: 1 / 1; }
.stage-rail-hold { grid-area: 2 / 1; margin: 24px 0 0; font-size: 15px; line-height: 1.5; }
/* Cues start hidden; the engine drives opacity and transform per frame. */
.stage-act [data-sc-cue] { opacity: 0; will-change: opacity, transform; }
```

`pointer-events: none` on the iframe: the stage is a display, and the frame's interrupt panel is already inert inside `/stage`; the "Open the live demo" link is the way in. Verify BrowserFrame's chrome height leaves the 1200/720 frame inside a 900px-tall viewport at 1440 wide (about 700 × 420 plus chrome); if it overflows, cap `.stage-frame` with `max-height: calc(100vh - 160px)` and let the aspect box shrink.

- [ ] **Step 6: Style contract** — in `style-contracts.spec.ts` add, following the file's existing pattern (`loadStylesheet('landing.css')`, `declarationsFor`):

```ts
it('the stage pin is sticky — the engine only warns when it is not', () => {
  const css = loadStylesheet('landing.css');
  expect(declarationsFor(css, '.stage-pin')).toMatch(/position:\s*sticky/);
  expect(declarationsFor(css, '.stage-act [data-sc-cue]')).toMatch(/opacity:\s*0/);
});
```

- [ ] **Step 7: Run** `npx nx test website -- Stage style-contracts analytics` — PASS. `npx eslint apps/website/src/components/landing apps/website/src/lib/analytics` — clean.

- [ ] **Step 8: Commit** `feat(website): the pinned stage act — engine mount, frame, rail cues, analytics`

---

### Task 8: Put it on the page

**Files:**
- Modify: `apps/website/src/app/page.tsx`
- Possibly modify: `apps/website/src/lib/section-media.ts` + spec, `apps/website/src/lib/build-panes.tsx`

- [ ] **Step 1: Replace the four FeatureBlocks** with `<Stage />` (import from `'../components/landing/Stage'`), between `<ScopeTable />` and `<FinalCTA ... />`. Remove the now-unused imports (`FeatureBlock`, `MediumSwitcher`, `SECTION_MEDIA`, `buildPanes`) and the `Promise.all` that built the panes. Keep `HomePage` async only if something else awaits.

- [ ] **Step 2: Dead data** — `grep -rn "SECTION_MEDIA\|buildPanes" apps/website/src --include='*.ts' --include='*.tsx' -l`. If the solutions pages still use them, leave `section-media.ts` alone. If nothing but its own spec uses `SECTION_MEDIA.stream/persist/approve/render`, delete those four entries and their spec cases, keeping the library and solution keys. Do not delete `DemoModal.tsx` or `MediumSwitcher.tsx` (solutions pages).

- [ ] **Step 3: Verify**

```bash
npx nx test website
npx nx lint website 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E "problems|error  "
npx nx build website 2>&1 | grep -E "error|Compiled|✓|Failed" | head
```
All green; the build is the only type check.

- [ ] **Step 4: Preview** — `npx nx serve website` (or `preview_start`), open `/`, scroll: the act pins, the rail crossfades, the frame shows the poster then the live frame (the iframe points at production `/stage`, which exists only after #1030 deploys; before that the poster holds and the 8 s timeout drops to the stills — expected). At 390px and under `prefers-reduced-motion` the stills render. Take a screenshot at the hold.

- [ ] **Step 5: Commit** `feat(website): the stage replaces the four capability blocks on the homepage`

---

### Task 9: Website e2e for the stage

**Files:**
- Create: `apps/website/e2e/home-stage.spec.ts`

- [ ] **Step 1: The spec**

```ts
import { test, expect, type Page } from '@playwright/test';

/** Drives the pinned act: the section is 6 viewports tall; scroll to a fraction of its travel. */
async function scrollAct(page: Page, p: number) {
  await page.evaluate((frac) => {
    const el = document.querySelector('[data-stage-act]') as HTMLElement;
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + (el.offsetHeight - window.innerHeight) * frac, behavior: 'instant' });
  }, p);
  await page.waitForTimeout(350); // the engine lerps 0.18/frame; ~20 frames to settle
}
const progress = (page: Page) =>
  page.evaluate(() => parseFloat((document.querySelector('[data-stage-act]') as HTMLElement).style.getPropertyValue('--sc-p')));

test.describe('homepage stage', () => {
  test('stills render first and the act upgrades on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const act = page.locator('[data-stage-act]');
    await expect(act).toHaveAttribute('data-sc-span', '6');
    await expect(act.locator('iframe')).toHaveAttribute('src', 'https://demo.threadplane.ai/stage?t=0');
    await expect(act.locator('.stage-pin')).toHaveCSS('position', 'sticky');
    await expect(page.getByTestId('stage-still-beat')).toHaveCount(0);
  });

  test('scroll drives the act: progress, cues, and the declared hold', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.locator('html')).toHaveClass(/sc-ready/);
    await scrollAct(page, 0.05);
    expect(await progress(page)).toBeGreaterThan(0);
    const stream = page.locator('.stage-rail-beat[data-beat="stream"]');
    await expect(stream).toHaveCSS('opacity', '1');
    await scrollAct(page, 0.55); // inside the approve hold (approve spans 0.4167..0.8333; hold 35–70% of it)
    await expect(page.locator('[data-stage-act]')).toHaveAttribute('data-sc-verify-hold', 'true');
    await expect(page.locator('.stage-rail-hold').last()).toHaveCSS('opacity', /^(0\.[5-9]\d*|1)$/);
    await scrollAct(page, 0.8);
    await expect(page.locator('[data-stage-act]')).not.toHaveAttribute('data-sc-verify-hold', 'true');
    await scrollAct(page, 1);
    await expect(page.locator('.stage-rail-beat[data-beat="render"]')).toHaveCSS('opacity', '1');
  });

  test('the frame answers and the verify state changes between positions', async ({ page }) => {
    test.skip(process.env['STAGE_LIVE_FRAME'] !== 'true', 'needs the deployed demo /stage (set STAGE_LIVE_FRAME=true after #1030 promotes)');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const act = page.locator('[data-stage-act]');
    await expect(act).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });
    await scrollAct(page, 0.1);
    await expect(act).toHaveAttribute('data-sc-verify-state', /^stream:\d+$/, { timeout: 15_000 });
    const a = await act.getAttribute('data-sc-verify-state');
    await scrollAct(page, 0.55);
    await expect(act).toHaveAttribute('data-sc-verify-state', /^pause:\d+$/, { timeout: 15_000 });
    expect(await act.getAttribute('data-sc-verify-state')).not.toBe(a);
    await scrollAct(page, 1);
    await expect(act).toHaveAttribute('data-sc-verify-state', /^render:\d+$/, { timeout: 20_000 });
  });

  test('phones and reduced motion get the stills', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByTestId('stage-still-beat')).toHaveCount(4);
    await expect(page.locator('[data-stage-act]')).toHaveCount(0);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.getByTestId('stage-still-beat')).toHaveCount(4);
    await expect(page.locator('[data-stage-act]')).toHaveCount(0);
  });
});
```

- [ ] **Step 2: Run** `npx nx e2e website -- --grep "homepage stage"` — 3 pass, 1 skipped. Fix the component, never the assertions' intent. If the `stream` cue is not at opacity 1 at p = 0.05, check `cueFor('stream')` gives ramp-in 0 (greet).

- [ ] **Step 3: Commit** `test(website): homepage stage e2e — upgrade, scroll-driven cues, the hold, the stills`

---

### Task 10: The scroll-craft harness in e2e

**Files:**
- Create: `apps/website/e2e/scroll-craft/shoot.mjs` (vendored, unmodified, from the same pinned commit: `plugins/nateherk-design/skills/scroll-craft/scripts/shoot.mjs`), `apps/website/e2e/scroll-craft/verify-home.mjs`, `apps/website/e2e/scroll-craft/README.md`
- Modify: `.github/workflows/ci.yml` (`website-e2e` job), `apps/website/eslint.config.mjs` (ignore `e2e/scroll-craft/shoot.mjs`)

`shoot.mjs` resolves `playwright-core` from the cwd's `package.json` (present at the repo root) and needs installed Chrome (`SCROLLCRAFT_CHROME` overrides; GitHub's ubuntu runners ship `/usr/bin/google-chrome`). It needs `ffmpeg` for the contact sheet; check whether it degrades without it (read the file's sheet section) and install it in CI with `sudo apt-get install -y ffmpeg` if it does not.

- [ ] **Step 1: `verify-home.mjs`**

```js
#!/usr/bin/env node
/**
 * Runs scroll-craft's shoot.mjs against a running website (spec §8) in the
 * three modes and fails on what the harness reports as defects:
 * DEAD SCROLL outside the declared hold, and cues that never peak.
 *   node apps/website/e2e/scroll-craft/verify-home.mjs --url http://127.0.0.1:4308 --out <dir>
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i > -1 && argv[i + 1] ? argv[i + 1] : d; };
const URL = arg('--url', 'http://127.0.0.1:4308');
const OUT = path.resolve(arg('--out', 'dist/stage-shots'));
const shoot = path.join(path.dirname(fileURLToPath(import.meta.url)), 'shoot.mjs');

const modes = [
  { name: 'desktop', args: ['--width', '1440', '--height', '900'] },
  { name: 'phone', args: ['--width', '390', '--height', '844'] },
  { name: 'reduced', args: ['--reduced-motion'] },
];
let failed = false;
for (const m of modes) {
  const r = spawnSync(process.execPath, [shoot, '--url', URL, '--out', path.join(OUT, m.name), '--per-act', '8', ...m.args], { encoding: 'utf8' });
  const out = `${r.stdout}\n${r.stderr}`;
  console.log(`\n=== ${m.name} ===\n${out}`);
  if (r.status !== 0) failed = true;
  if (/DEAD SCROLL between/.test(out)) failed = true;
  if (/never (?:reach|peak)/i.test(out)) failed = true;
}
process.exit(failed ? 1 : 0);
```
Read `shoot.mjs`'s summary lines once and align the two regexes with its exact wording ("DEAD SCROLL between:" is verbatim; find the cue-peak line).

- [ ] **Step 2: README** — what it verifies, the two commands (build + `next start`, then verify), where the contact sheets land, and that the phone and reduced-motion passes see the stills (no pinned act), so their dead-scroll check is trivially clean and their value is the contact sheet and the contrast pass.

- [ ] **Step 3: Local run**

```bash
npx nx build website
(cd apps/website && npx next start -p 4308 &) ; sleep 5
node apps/website/e2e/scroll-craft/verify-home.mjs --url http://127.0.0.1:4308 --out /path/to/scratchpad/stage-shots
```
Read `desktop/sheet.png` (Read tool) and check the act frames: poster or frame, rail cues at full opacity somewhere in each beat, the hold lines during the hold. Fix any DEAD SCROLL by adjusting cue windows in `stage-beats.ts` (not by publishing raw progress). Kill the server.

- [ ] **Step 4: CI** — in `.github/workflows/ci.yml`, `website-e2e` job, after the "Public copy boundary (production build)" step:

```yaml
      - name: Stage scroll verification (scroll-craft harness)
        env:
          GROWTH_FORM_POLICY: growth_v1
        run: |
          npx nx build website
          (cd apps/website && npx next start -p 4308 > /tmp/next-start.log 2>&1 &)
          for i in $(seq 1 30); do curl -sf http://127.0.0.1:4308/ > /dev/null && break; sleep 1; done
          node apps/website/e2e/scroll-craft/verify-home.mjs --url http://127.0.0.1:4308 --out dist/stage-shots
      - name: Upload stage contact sheets
        if: always()
        uses: actions/upload-artifact@<pinned sha the workflow already uses for upload-artifact; copy from another step>
        with:
          name: stage-shots
          path: dist/stage-shots/**/sheet.png
          if-no-files-found: ignore
```
Check whether the production public-copy step already builds (`WEBSITE_E2E_MODE=production` serves "the already completed Nx production build" — read `playwright.config.ts`'s `webServer` for that mode and reuse its build if it is cached by Nx; `npx nx build website` is a cache hit then).

- [ ] **Step 5: Commit** `test(website): scroll-craft verification of the homepage stage in CI`

---

### Task 11: Verification and PR

- [ ] **Step 1: Everything**

```bash
npx nx test website
npx nx lint website 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E "problems|error  "
npx nx build website 2>&1 | grep -iE "error|compiled|failed" | head
npx nx e2e website -- --grep "homepage stage|homepage hero|public copy"
cd examples/chat/angular && npx vitest run src/app/stage && cd ../../..
npx nx build examples-chat-angular --configuration=production 2>&1 | grep -E "Initial total|exceeded|Successfully"
```
All green. Then, if #1030 has promoted to `demo.threadplane.ai` (check `curl -s https://demo.threadplane.ai/stage | head -c 200` returns the app shell): `STAGE_LIVE_FRAME=true npx nx e2e website -- --grep "the frame answers"` — pass, and paste the three `data-sc-verify-state` values into the PR.

- [ ] **Step 2: Rebase** onto `origin/main` (after #1030 merges), re-run the unit suites, push, PR:

```bash
git push -u origin blove/stage-homepage
gh pr create --title "feat(website): the stage on the homepage — one real run, scrubbed by scroll (live-stage plan 3 of 3)" --body-file - <<'EOF'
## Why

Plan 3 of the homepage live stage (`docs/superpowers/specs/2026-09-05-homepage-live-stage-design.md` §4.1, §4.3, §5.2, §6–§10). Plan 1 restructured the page (#1024); plan 2 built the seekable `/stage` route in the demo app (#1030). This PR puts it on the homepage.

## What

- One pinned act (`data-sc-act="pin" data-sc-span="6"`) driven by scroll-craft's engine, vendored unmodified and hash-pinned at `0b81622` (MIT). Its CSS is not vendored; the sticky and cue rules live under the website's style contract.
- `stage-beats.ts`: shares (1.3 / 1.2 / 2.4 / 1.1 vh), the piecewise monotonic scroll → time map, the 35–70% hold inside Approve where recorded time is pinned at the interrupt, the threshold at 70% that dispatches the resume, the render tail on the mounted form, and the rail's cue windows — one table, two views.
- A DOM-only publisher posts `{ type: 'tplane-stage', t }` to the iframe when `t` changes and the act is on screen; the frame's `{ applied, phase }` lands in `data-sc-verify-state`, the hold in `data-sc-verify-hold`, so the harness sees the bespoke stage.
- Fallback: four stacked stills with the same copy — the server-rendered default, kept below 1024px, under reduced motion, without JS, or when the frame never reports ready.
- Analytics: `marketing:stage_progress` with `enter | beat | threshold | complete`.
- The four capability `FeatureBlock`s leave the homepage (they stay for the solutions pages).
- scroll-craft's `shoot.mjs` runs in CI against `next start` at desktop, phone and reduced motion; fails on dead scroll outside the declared hold and on cues that never peak; contact sheets are an artifact.

## Tests

Beat map (monotonic, boundaries, hold, threshold, tail, cues), publisher (posts on change only, origin check, verify attributes, milestones once each), Stage mode switch, stills, style contract, analytics, positioning; e2e for the upgrade, scroll-driven cues and the hold, the stills, and (env-gated) the live frame's verify state.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
gh pr merge --auto --squash
```

---

## Self-review

**Spec coverage:** §4.1 layout (Task 7: two columns, `data-sc-cue` rail, greet form on the first beat via `cueFor`, closing hold on the last, the poster as the ground before progress leaves zero); §4.3 protocol (Task 1 extends `ready`; Task 6 posts `t` per changed frame while on screen and writes `data-sc-verify-state`, origin-checked both ways); §5.2 beat map (Task 3, data in one file; cue windows derived from the shares; recording numbers from `ready`); §6 peak (Task 3's three ranges, `data-sc-verify-hold` in Task 6, the threshold as a scroll position, scrolling back above 70% rewinds because `timeAt` is pure in `p` and the frame rewinds on a backward seek); §7 smoothness (one playhead — the engine's lerp; the parent writes nothing but one attribute and one message per frame; batching and the rewind budget are plan 2's); §8 fallbacks (Task 5, Task 7's `Stage` gate at 1024px / reduced motion / no JS / ready timeout; harness in Task 10; rail is real markup; iframe has a title and `tabIndex=-1`, stills have alt text); §9 analytics (Task 7 Step 1 + Task 6 milestones); §10 tests (each listed test has a task: monotonic map, publisher posts on change only while on screen, stills render four beats, public-copy scan, e2e verify-state change and the harness).

**Deviations stated:** §8's harness runs in CI at desktop only: the vendored `shoot.mjs` waits for `html.sc-ready`, which only a pinned act sets, and below 1024px or under reduced motion the page is the stills with no engine, so the phone and reduced-motion passes are opt-in (`--modes`) and exist for the contact sheet and the contrast pass. It samples eight positions per act, not the spec's six. `next start` cannot serve the Nx build (the emitted next.config is rewritten), so the harness runs against `nx serve --configuration=production`. §7's "snapshot checkpoints every 200 events" was deferred in plan 2 and is not revisited here. §8's phone stills carry no devtools (the stage docks none below 768px, plan 2's decision); the rail copy carries the checkpoint claim. §9's "win condition" is a reporting task, not code. The "Open the live demo" link goes to the demo root, not `/stage`, because `/stage` has no live mode. The iframe is `pointer-events: none` on the homepage (the spec makes the panel inert inside `/stage`; the parent additionally makes the whole frame a display, which keeps wheel events on the page so the scrubber never fights the frame's own scroll).

**Placeholder scan:** the hash in Task 2 and the `upload-artifact` SHA in Task 10 are read from the environment at execution time and the steps say how. No TBDs.

**Type consistency:** `StageReadyMessage` (Task 3) matches the fields Task 1 posts (`totalMs`, `beats`, `hold`, `reloadEndMs`); `StageBeat` in `stage-beats.ts` and `StageBeatKey` in `positioning.ts` are the same union (the spec test in Task 4 asserts the order); `createStagePublisher` (Task 6) is consumed by `StageAct` (Task 7) through `useStagePublisher` with `frameWindow`, `track`, `onReady`; `trackStageProgress(stage_event, beat)` (Task 7 Step 1) matches the `track` callback's `(milestone, beat)` shape; `cueFor`/`holdLineCues` (Task 3) feed the `data-sc-cue` attributes the e2e (Task 9) asserts through opacity.
