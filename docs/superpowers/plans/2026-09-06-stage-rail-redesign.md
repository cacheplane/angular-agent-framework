# Stage Rail Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the homepage stage's right column with a completeness ledger: a four-segment act navigation bar, one check + one claim + one docs link + one derived proof line per beat, a single hold line, and an ending that lists all four claims checked above "Feature complete for the final mile." with the install command.

**Architecture:** Copy is single-sourced in `positioning.ts`; proof numbers are derived from the committed recording at build time by `stage-proof.ts` and passed down as props from the server page; the publisher (already DOM-only, ticking per frame) gains two attribute writes (segment state, check fill) driven by a new `settleAt(beat)` in `stage-beats.ts`; `StageAct` and `StageStills` render the new anatomy; the ending is one more cue whose window is the render beat's closing hold.

**Tech Stack:** Next.js (apps/website, React 19, Vitest, Playwright), the vendored scroll-craft engine (unchanged), the demo recording `examples/chat/angular/public/stage-replay.json` (unchanged).

**Spec:** `docs/superpowers/specs/2026-09-06-stage-rail-redesign-design.md`.

---

## Conventions

- Branch `blove/stage-rail-redesign` (cut from `origin/main` at `4c1db10c6`). Never `git stash`. Run commands from the repo root; website unit tests via `cd apps/website && npx vitest run <pattern>` for detail, `npx nx test website` for the whole suite. Only `npx nx build website` type-checks the website.
- Public copy is scanned by `apps/website/src/lib/public-copy.spec.ts` against `BANNED_CLAIMS`; no competitor names; the only scroll cue allowed is "Keep scrolling to approve".
- `landing.css` and `positioning.ts` are not prettier-clean at HEAD; match their neighbourhood style and never reformat them wholesale.
- The beat keys stay `stream | persist | approve | render` (they are the recording's and the beat map's). Only labels and claims change.
- The e2e dev server is `http://127.0.0.1:4308`; free the port before running (`lsof -iTCP:4308 -sTCP:LISTEN -n`).

## File structure

- Modify `apps/website/src/lib/positioning.ts` (+spec): `STAGE_RAIL` gets `label`, `claim`, `docs`; loses `eyebrow`, `headline`, `body`, `rows`, `cta`. New `STAGE_HOLD_LINE`, `STAGE_CLOSE`. Word-budget spec.
- Create `apps/website/src/lib/stage-proof.ts` (+spec): reads the recording, exports `deriveStageProof(recording)` and `STAGE_PROOF`.
- Modify `apps/website/src/lib/stage-beats.ts` (+spec): `settleAt(beat)`, `segmentState(beat, p)`.
- Modify `apps/website/src/components/landing/use-stage-publisher.ts` (+spec): writes `data-beat-state` on `[data-stage-segment]` and `data-checked` on `[data-stage-check]` when they change.
- Modify `apps/website/src/components/landing/StageAct.tsx`, `StageStills.tsx`, `Stage.tsx` (+`Stage.spec.tsx`): new anatomy, `proof` prop, segment click navigation, the ending cue.
- Modify `apps/website/src/app/page.tsx`: passes `STAGE_PROOF` to `<Stage proof={...} />`.
- Modify `apps/website/src/styles/landing.css` (+`style-contracts.spec.ts`): replace the `.stage-rail-*` rules.
- Modify `apps/website/e2e/home-stage.spec.ts`.

---

### Task 1: Copy

**Files:** modify `apps/website/src/lib/positioning.ts`, `apps/website/src/lib/positioning.spec.ts`.

- [ ] **Step 1: Failing tests** — replace the two `STAGE_RAIL` cases in `positioning.spec.ts` with:

```ts
describe('STAGE_RAIL', () => {
  it('has one entry per beat in the beat map order, each a short claim with one docs link', () => {
    expect(STAGE_RAIL.map((b) => b.beat)).toEqual([...STAGE_BEATS]);
    for (const b of STAGE_RAIL) {
      expect(b.label.length).toBeLessThanOrEqual(8);
      expect(b.claim.length).toBeLessThanOrEqual(40);
      expect(b.claim.endsWith('.')).toBe(true);
      expect(b.docs.label).not.toBe('');
      expect(b.docs.href).toMatch(/^\//);
      expect(b.stillAlt.length).toBeGreaterThan(40);
    }
    expect(STAGE_RAIL.map((b) => b.label)).toEqual(['Tools', 'Persist', 'Approve', 'Render']);
  });
  it('carries one hold line and the closing ledger copy', () => {
    expect(STAGE_HOLD_LINE).toBe('Keep scrolling to approve.');
    expect(STAGE_CLOSE.claim).toBe('Feature complete for the final mile.');
    expect(STAGE_CLOSE.install).toBe(INSTALL_OPTIONS[0].command.split('\n')[0]);
    expect(STAGE_CLOSE.cta.href).toBe(INSTALL_OPTIONS[0].quickstartHref);
  });
  it('keeps the rail under the word budget: four beats plus the ending', () => {
    const words = (s: string) => s.trim().split(/\s+/).length;
    const total =
      STAGE_RAIL.reduce((n, b) => n + words(b.claim) + words(b.docs.label), 0) +
      words(STAGE_HOLD_LINE) +
      words(STAGE_CLOSE.claim) +
      words(STAGE_CLOSE.cta.label);
    expect(total).toBeLessThan(90);
  });
});
```
Check `INSTALL_OPTIONS[0].command` — if it is multi-line, the first line is the `npm i` command; otherwise use it whole. Adjust the assertion to the real shape and keep `STAGE_CLOSE.install` derived from it, not retyped.

- [ ] **Step 2: Run** `cd apps/website && npx vitest run positioning` — FAIL.

- [ ] **Step 3: Implement** — replace the `StageRailBeat` interface, `STAGE_RAIL`, and `STAGE_HOLD_LINES` with:

```ts
export interface StageRailBeat {
  readonly beat: StageBeatKey;
  /** Segment label in the act navigation bar. */
  readonly label: string;
  /** The one line the rail says for this beat. */
  readonly claim: string;
  /** The page that proves it. */
  readonly docs: { readonly label: string; readonly href: string };
  /** Alt text for the fallback still: what the frame shows at this beat's settle. */
  readonly stillAlt: string;
}

export const STAGE_RAIL: readonly StageRailBeat[] = [
  {
    beat: 'stream',
    label: 'Tools',
    claim: 'Tool calls and citations as signals.',
    docs: { label: 'Tool calls', href: '/docs/chat/components/chat-tool-calls' },
    stillAlt: '<keep the existing stream stillAlt verbatim>',
  },
  {
    beat: 'persist',
    label: 'Persist',
    claim: 'Durable threads, no license.',
    docs: { label: 'Persistence', href: '/docs/langgraph/guides/persistence' },
    stillAlt: '<keep>',
  },
  {
    beat: 'approve',
    label: 'Approve',
    claim: 'Interrupts and approvals, built in.',
    docs: { label: 'Interrupts', href: '/docs/langgraph/guides/interrupts' },
    stillAlt: '<keep>',
  },
  {
    beat: 'render',
    label: 'Render',
    claim: 'Generative UI on A2UI and json-render.',
    docs: { label: '@threadplane/render', href: '/render' },
    stillAlt: '<keep>',
  },
];

/** Spec §3.3: the only copy shown while recorded time is pinned at the interrupt, and the page's one scroll cue. */
export const STAGE_HOLD_LINE = 'Keep scrolling to approve.';

/** Spec §3.4: the last screen. `install` is derived from the install options so the command lives in one place. */
export const STAGE_CLOSE = {
  claim: 'Feature complete for the final mile.',
  install: INSTALL_OPTIONS[0].command.split('\n')[0],
  cta: { label: 'Spike it this week', href: INSTALL_OPTIONS[0].quickstartHref },
} as const;
```
`INSTALL_OPTIONS` is declared later in the file; move `STAGE_CLOSE` below it (or hoist `INSTALL_OPTIONS` above) so there is no TDZ error. Delete `STAGE_HOLD_LINES`.

- [ ] **Step 4: Run** `npx vitest run positioning public-copy` — PASS. The build will be red until Tasks 4–5 update the consumers; that is expected.

- [ ] **Step 5: Commit** `feat(website): stage rail copy becomes a four-claim ledger`

---

### Task 2: Proof lines from the recording

**Files:** create `apps/website/src/lib/stage-proof.ts`, `apps/website/src/lib/stage-proof.spec.ts`.

The recording (`examples/chat/angular/public/stage-replay.json`, version 2) has `runs[]` (`beat`, `action.kind`, `events[{tMs,event}]`) and `histories[{afterRun, states[]}]`. Shapes found in the committed take:
- Run 0 (`stream`, submit): 586 events; the `search_documents` ToolMessage's `content` is a JSON string of an array of documents (`[{id,title,url,snippet,...}]`) — the number of sources.
- Runs 1–3 (`persist`): run 1 is the reload; run 3 is the fork with `action.checkpointIndex = 9`; `histories` with `afterRun === 4` has 10 states.
- Run 4 (`approve`, submit): an event `{ type: 'updates', __interrupt__: [{ value: { type: 'approval_request', ids: [...], ... } }] }`.
- Run 6 (`render`): the `render_a2ui_surface` ToolMessage `content` is a JSON string of an array of A2UI envelopes; component count = the number of entries under every `updateComponents.components` (or the same list under whatever key the envelope uses — inspect and count objects that carry a `component` key).

- [ ] **Step 1: Failing test**

```ts
// stage-proof.spec.ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deriveStageProof, STAGE_PROOF } from './stage-proof';

const REC = resolve(__dirname, '../../../../examples/chat/angular/public/stage-replay.json');

describe('stage proof', () => {
  const rec = JSON.parse(readFileSync(REC, 'utf8'));
  const proof = deriveStageProof(rec);
  it('counts the first beat from the recording, never types it', () => {
    expect(proof.stream).toMatch(/^\d{3,} events · 1 tool call · \d sources$/);
    expect(proof.stream.startsWith(`${rec.runs[0].events.length} events`)).toBe(true);
  });
  it('reads the reload, the checkpoint count and the fork step', () => {
    expect(proof.persist).toMatch(/^reloaded · \d+ checkpoints · forked at step \d+$/);
  });
  it('reads the pending interrupt and the checkpoint count', () => {
    expect(proof.approve).toMatch(/^1 interrupt pending · checkpoint \d+ of \d+$/);
  });
  it('reads the surface and its component count', () => {
    expect(proof.render).toMatch(/^1 surface · \d+ components · no generated code ran$/);
  });
  it('drops a segment it cannot derive instead of defaulting it', () => {
    const noCitations = { ...rec, runs: rec.runs.map((r: { beat: string }, i: number) => (i === 0 ? { ...r, events: [] } : r)) };
    const p = deriveStageProof(noCitations);
    expect(p.stream).not.toMatch(/sources/);
    expect(p.stream).not.toMatch(/NaN|undefined/);
  });
  it('is what the page ships', () => {
    expect(STAGE_PROOF).toEqual(proof);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run stage-proof` — FAIL.

- [ ] **Step 3: Implement**

```ts
// stage-proof.ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { StageBeat } from './stage-beats';

/**
 * Proof lines for the stage rail (spec §4): counts read from the committed
 * recording at build time. Nothing here is typed by hand; a segment whose
 * number cannot be derived is omitted, never estimated. The one phrase that is
 * a property rather than a count is "no generated code ran".
 */
interface RecordedRun { beat: string; action: { kind: string; checkpointIndex?: number }; events: { event: unknown }[] }
interface Recording { runs: RecordedRun[]; histories: { afterRun: number; states: unknown[] }[] }

type Msg = { type?: string; name?: string; content?: unknown };

function messagesOf(run: RecordedRun): Msg[] {
  const out: Msg[] = [];
  for (const { event } of run.events) {
    const ev = event as Record<string, unknown>;
    const lists = [ev['messages'], (ev['data'] as Record<string, unknown> | undefined)?.['messages'], ev['data']];
    for (const l of lists) if (Array.isArray(l)) out.push(...(l.filter((m) => m && typeof m === 'object') as Msg[]));
  }
  return out;
}

function toolResult(run: RecordedRun, name: string): unknown {
  const m = messagesOf(run).filter((x) => x.type === 'tool' && x.name === name).at(-1);
  if (!m || typeof m.content !== 'string') return undefined;
  try { return JSON.parse(m.content); } catch { return undefined; }
}

function toolCallNames(run: RecordedRun): Set<string> {
  const names = new Set<string>();
  for (const m of messagesOf(run)) {
    if (!Array.isArray(m.content)) continue;
    for (const part of m.content as { type?: string; name?: string }[]) if (part?.type === 'function_call' && part.name) names.add(part.name);
  }
  return names;
}

function countKey(o: unknown, key: string): number {
  if (Array.isArray(o)) return o.reduce((n, v) => n + countKey(v, key), 0);
  if (o && typeof o === 'object') return Object.entries(o).reduce((n, [k, v]) => n + (k === key ? 1 : 0) + countKey(v, key), 0);
  return 0;
}

const join = (parts: (string | null)[]) => parts.filter((p): p is string => p !== null).join(' · ');
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

export function deriveStageProof(rec: Recording): Record<StageBeat, string> {
  const run = (beat: string, kind: string, nth = 0) => rec.runs.filter((r) => r.beat === beat && r.action.kind === kind)[nth];
  const histAfter = (i: number) => rec.histories.filter((h) => h.afterRun === i).at(-1)?.states.length ?? null;

  const r0 = run('stream', 'submit');
  const sources = Array.isArray(toolResult(r0, 'search_documents')) ? (toolResult(r0, 'search_documents') as unknown[]).length : null;
  const stream = join([
    r0.events.length > 0 ? plural(r0.events.length, 'event') : null,
    toolCallNames(r0).size > 0 ? plural(toolCallNames(r0).size, 'tool call') : null,
    sources ? plural(sources, 'source') : null,
  ]);

  const reload = rec.runs.some((r) => r.action.kind === 'reload');
  const fork = rec.runs.find((r) => r.action.checkpointIndex !== undefined);
  const forkIdx = rec.runs.indexOf(fork!);
  const checkpoints = fork ? histAfter(forkIdx + 1) : null;
  // history() is newest-first: index i of n is step n - i.
  const forkStep = fork && checkpoints !== null ? checkpoints - (fork.action.checkpointIndex ?? 0) : null;
  const persist = join([reload ? 'reloaded' : null, checkpoints ? plural(checkpoints, 'checkpoint') : null, forkStep ? `forked at step ${forkStep}` : null]);

  const r4 = run('approve', 'submit');
  const interrupted = r4.events.some(({ event }) => Array.isArray((event as Record<string, unknown>)['__interrupt__']));
  const r4i = rec.runs.indexOf(r4);
  const last = histAfter(r4i) ?? histAfter(r4i + 1);
  const approve = join([interrupted ? '1 interrupt pending' : null, last ? `checkpoint ${last} of ${last}` : null]);

  const r6 = run('render', 'submit');
  const surface = toolResult(r6, 'render_a2ui_surface');
  const surfaces = Array.isArray(surface) ? countKey(surface, 'createSurface') : 0;
  const components = Array.isArray(surface) ? countKey(surface, 'component') : 0;
  const render = join([surfaces ? plural(surfaces, 'surface') : null, components ? plural(components, 'component') : null, 'no generated code ran']);

  return { stream, persist, approve, render };
}

const RECORDING = resolve(process.cwd(), 'examples/chat/angular/public/stage-replay.json');
const RECORDING_FROM_APP = resolve(process.cwd(), '../../examples/chat/angular/public/stage-replay.json');

function readRecording(): Recording {
  for (const p of [RECORDING, RECORDING_FROM_APP]) {
    try { return JSON.parse(readFileSync(p, 'utf8')) as Recording; } catch { /* next */ }
  }
  throw new Error('stage-replay.json not found; the website build reads the demo recording for the stage proof lines');
}

export const STAGE_PROOF: Record<StageBeat, string> = deriveStageProof(readRecording());
```
The cwd differs between `nx build website` (repo root) and `cd apps/website && vitest`; the two candidates cover both. Verify the counts against the take by printing them once (expected order of magnitude: 586 events, 1 tool call, a small number of sources; 10 checkpoints; forked at step 1; checkpoint 10 of 10; 1 surface, ~7 components). If the search result's array length is not what the frame's Sources badge shows (3), find the field the badge counts and use that — the proof must match what the frame displays.

- [ ] **Step 4: Run** — PASS. `npx eslint apps/website/src/lib/stage-proof.ts` clean. Confirm the module is server-only: it uses `node:fs`, so it must only be imported from `page.tsx` (server) — never from a `'use client'` file.

- [ ] **Step 5: Commit** `feat(website): stage proof lines derived from the recording`

---

### Task 3: Settle points and segment state

**Files:** modify `apps/website/src/lib/stage-beats.ts`, `stage-beats.spec.ts`.

- [ ] **Step 1: Failing tests**

```ts
describe('settleAt / segmentState', () => {
  it('settles tools and persist at their window end, approve at the threshold, render before its tail', () => {
    const w = beatWindows();
    expect(settleAt('stream')).toBe(w[0].to);
    expect(settleAt('persist')).toBe(w[1].to);
    expect(settleAt('approve')).toBe(APPROVE_THRESHOLD_P);
    expect(settleAt('render')).toBeCloseTo(w[3].from + (w[3].to - w[3].from) * (1 - RENDER_TAIL), 6);
  });
  it('reports done / now / todo per beat from progress', () => {
    const w = beatWindows();
    expect(segmentState('stream', 0.05)).toBe('now');
    expect(segmentState('persist', 0.05)).toBe('todo');
    expect(segmentState('stream', w[1].from + 0.01)).toBe('done');
    expect(segmentState('approve', w[2].from + 0.01)).toBe('now');
    expect(segmentState('render', 1)).toBe('now');
  });
  it('a beat is checked once progress passes its settle', () => {
    expect(isChecked('approve', APPROVE_THRESHOLD_P - 0.001)).toBe(false);
    expect(isChecked('approve', APPROVE_THRESHOLD_P)).toBe(true);
    expect(isChecked('render', 0.999)).toBe(true);
  });
});
```

- [ ] **Step 2: Implement** in `stage-beats.ts`:

```ts
/** Act progress at which a beat's claim is proven on screen and its check fills. */
export function settleAt(beat: StageBeat): number {
  const w = WINDOWS[STAGE_BEATS.indexOf(beat)];
  if (beat === 'approve') return APPROVE_THRESHOLD_P;
  if (beat === 'render') return w.from + (w.to - w.from) * (1 - RENDER_TAIL);
  return w.to;
}
export type SegmentState = 'done' | 'now' | 'todo';
export function segmentState(beat: StageBeat, p: number): SegmentState {
  const current = beatAt(p);
  if (beat === current) return 'now';
  return STAGE_BEATS.indexOf(beat) < STAGE_BEATS.indexOf(current) ? 'done' : 'todo';
}
export function isChecked(beat: StageBeat, p: number): boolean {
  return p >= settleAt(beat);
}
```

- [ ] **Step 3: Run** `npx vitest run stage-beats` — PASS. **Commit** `feat(website): beat settle points and segment states`

---

### Task 4: Publisher writes segment and check state

**Files:** modify `apps/website/src/components/landing/use-stage-publisher.ts`, `use-stage-publisher.spec.ts`.

- [ ] **Step 1: Failing test**

```ts
it('writes segment states and check fills onto the rail as progress moves', () => {
  const { section, pub } = setup();
  for (const b of STAGE_BEATS) {
    const seg = document.createElement('a'); seg.setAttribute('data-stage-segment', b); section.appendChild(seg);
    const chk = document.createElement('span'); chk.setAttribute('data-stage-check', b); section.appendChild(chk);
  }
  section.style.setProperty('--sc-p', '0.05'); pub.tick();
  expect(section.querySelector('[data-stage-segment="stream"]')!.getAttribute('data-beat-state')).toBe('now');
  expect(section.querySelector('[data-stage-segment="persist"]')!.getAttribute('data-beat-state')).toBe('todo');
  expect(section.querySelector('[data-stage-check="stream"]')!.hasAttribute('data-checked')).toBe(false);
  section.style.setProperty('--sc-p', String(beatWindows()[1].from + 0.01)); pub.tick();
  expect(section.querySelector('[data-stage-segment="stream"]')!.getAttribute('data-beat-state')).toBe('done');
  expect(section.querySelector('[data-stage-check="stream"]')!.hasAttribute('data-checked')).toBe(true);
  section.style.setProperty('--sc-p', '1'); pub.tick();
  expect(section.querySelectorAll('[data-stage-check][data-checked]')).toHaveLength(4);
});
```

- [ ] **Step 2: Implement** — in `createStagePublisher`, query the segments and checks once at construction (`section.querySelectorAll('[data-stage-segment]')`, `'[data-stage-check]'`), keep the last written state per element, and in `tick()` after the hold update:

```ts
for (const el of segments) {
  const s = segmentState(el.getAttribute('data-stage-segment') as StageBeat, p);
  if (el.getAttribute('data-beat-state') !== s) el.setAttribute('data-beat-state', s);
}
for (const el of checks) {
  const on = isChecked(el.getAttribute('data-stage-check') as StageBeat, p);
  if (on !== el.hasAttribute('data-checked')) { if (on) el.setAttribute('data-checked', ''); else el.removeAttribute('data-checked'); }
}
```
Attribute writes only when changed (the harness signature and the browser's style recalc both benefit).

- [ ] **Step 3: Run** `npx vitest run use-stage-publisher` — PASS; eslint clean. **Commit** `feat(website): stage publisher drives the segment bar and the checks`

---

### Task 5: The act

**Files:** modify `apps/website/src/components/landing/StageAct.tsx`, `Stage.tsx`, `Stage.spec.tsx`, `apps/website/src/app/page.tsx`, `apps/website/src/styles/landing.css`, `apps/website/src/styles/style-contracts.spec.ts`.

- [ ] **Step 1: Failing tests** — in `Stage.spec.tsx`'s wide case, replace the rail assertions with:

```ts
const act = document.querySelector('[data-stage-act]')!;
expect(act.querySelectorAll('[data-stage-segment]')).toHaveLength(4);
expect([...act.querySelectorAll('[data-stage-segment]')].map((s) => s.textContent)).toEqual(['Tools', 'Persist', 'Approve', 'Render']);
expect(act.querySelectorAll('[data-testid="stage-rail-beat"]')).toHaveLength(4);
expect(act.querySelectorAll('[data-stage-check]')).toHaveLength(4 + 4); // one per beat block, four in the ledger
expect(act.querySelector('[data-testid="stage-rail-hold"]')!.textContent).toBe('Keep scrolling to approve.');
expect(act.querySelector('[data-testid="stage-rail-close"]')).not.toBeNull();
expect(act.querySelector('[data-testid="stage-rail-close"]')!.textContent).toContain('Feature complete for the final mile.');
for (const a of act.querySelectorAll('.stage-rail a')) expect(a.getAttribute('tabindex')).toBe('-1');
expect(act.querySelector('[data-testid="stage-rail-beat"][data-beat="stream"] [data-stage-proof]')!.textContent).toBe(PROOF.stream);
```
where `PROOF` is a fixture passed as `<Stage proof={PROOF} />` in the spec. Also a case: clicking the Persist segment calls `window.scrollTo` with a top inside the persist window (stub `scrollTo`, give the section an `offsetHeight` via `Object.defineProperty`, `innerHeight` 900).

- [ ] **Step 2: Implement `StageAct`** — props become `{ onFallback, proof: Record<StageBeat, string> }`. Replace the rail markup:

```tsx
<div className="stage-rail">
  <h2 id="stage-heading" className="sr-only">One real run: tools, persist, approve, render</h2>
  <nav className="stage-segs" aria-label="Stage beats">
    {STAGE_RAIL.map((b) => (
      <a key={b.beat} href={`#stage-${b.beat}`} className="stage-seg" data-stage-segment={b.beat} data-beat-state="todo" tabIndex={-1}
         onClick={(e) => { e.preventDefault(); scrollToBeat(b.beat); }}>
        {b.label}
      </a>
    ))}
  </nav>
  {STAGE_RAIL.map((b) => (
    <div className="stage-rail-beat" data-testid="stage-rail-beat" data-beat={b.beat} data-sc-cue={cueFor(b.beat)} key={b.beat}>
      <span className="stage-check" data-stage-check={b.beat} aria-hidden="true" />
      <div>
        <p className="stage-claim">{b.claim}</p>
        <Link href={b.docs.href} className="stage-doc" tabIndex={-1}>{b.docs.label}</Link>
        <p className="stage-proof" data-stage-proof>{proof[b.beat]}</p>
      </div>
    </div>
  ))}
  <p className="stage-rail-hold" data-testid="stage-rail-hold" data-sc-cue={holdCue()}>{STAGE_HOLD_LINE}</p>
  <div className="stage-rail-close" data-testid="stage-rail-close" data-sc-cue={closeCue()}>
    <ul className="stage-ledger">
      {STAGE_RAIL.map((b) => (
        <li key={b.beat}><span className="stage-check" data-stage-check={b.beat} aria-hidden="true" />{b.claim}<Link href={b.docs.href} className="stage-doc" tabIndex={-1}>{b.docs.label}</Link></li>
      ))}
    </ul>
    <p className="stage-claim">{STAGE_CLOSE.claim}</p>
    <div className="stage-install"><code>{STAGE_CLOSE.install}</code><Link href={STAGE_CLOSE.cta.href} className="stage-install-cta" tabIndex={-1}>{STAGE_CLOSE.cta.label} →</Link></div>
    <p className="stage-trust">{HERO_TRUST_LINE} · LangGraph and AG-UI</p>
  </div>
</div>
```
with, in `stage-beats.ts` (add to Task 3 if you are there first): `holdCue()` = the approve hold range as a two-value cue (`start end` from `holdLineCues(1)[0]`, so replace `holdLineCues` with `holdCue()` returning one string and delete the count version), and `closeCue()` = `"${settleAt('render')} 1 0.3 0"`; and `cueFor('render')` must now END at the render settle (`"${from} ${settleAt('render')}"`, no closing hold) so the render block crossfades into the ledger. Update `cueFor`'s spec for the last beat accordingly. `scrollToBeat(beat)`:

```ts
const scrollToBeat = (beat: StageBeat) => {
  const el = sectionRef.current; if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY;
  const w = beatWindows()[STAGE_BEATS.indexOf(beat)];
  window.scrollTo({ top: top + (el.offsetHeight - window.innerHeight) * (w.from + 0.02), behavior: 'smooth' });
};
```
Remove the `Eyebrow`, `feature-block-*` usage and the `STAGE_HOLD_LINES`/`holdLineCues` imports from the act. `Stage.tsx` gains a `proof` prop and forwards it to both `StageAct` and `StageStills`. `page.tsx`: `import { STAGE_PROOF } from '../lib/stage-proof';` and `<Stage proof={STAGE_PROOF} />` (server component importing a `node:fs` module is fine; the client boundary receives a plain object).

- [ ] **Step 3: CSS** — replace the `.stage-rail`, `.stage-rail-beat`, `.stage-rail-hold` rules with:

```css
/* The rail: a segment bar on top, the beat blocks stacked in one cell so cues
 * crossfade in place, the hold line and the closing ledger in cells beneath. */
.stage-rail { display: grid; grid-template-rows: auto auto auto; align-content: center; min-height: 60vh; row-gap: 28px; }
.stage-segs { display: flex; gap: 10px; }
.stage-seg { flex: 1; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 600; color: var(--color-text-secondary); text-decoration: none; padding-top: 10px; position: relative; opacity: 0.45; }
.stage-seg::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; border-radius: 2px; background: var(--color-border); }
.stage-seg[data-beat-state='done'] { opacity: 0.95; }
.stage-seg[data-beat-state='done']::before { background: var(--color-accent-green, #2f6f4f); }
.stage-seg[data-beat-state='now'] { opacity: 1; color: var(--color-text-primary); }
.stage-seg[data-beat-state='now']::before { background: var(--color-text-primary); }
.stage-rail-beat { grid-area: 2 / 1; display: flex; gap: 14px; align-items: flex-start; }
.stage-check { flex: none; width: 22px; height: 22px; border-radius: 50%; border: 1.5px solid var(--color-border-strong, var(--color-border)); margin-top: 8px; display: inline-flex; align-items: center; justify-content: center; }
.stage-check[data-checked]::after { content: '✓'; font-size: 12px; font-weight: 700; }
.stage-check[data-checked] { background: var(--color-accent-green, #2f6f4f); border-color: var(--color-accent-green, #2f6f4f); color: #fff; }
.stage-claim { font-family: var(--font-serif); font-size: 34px; line-height: 1.08; font-weight: 500; margin: 0; }
.stage-doc { display: inline-block; margin-top: 12px; font-size: 12px; opacity: 0.55; text-decoration: none; border-bottom: 1px solid var(--color-border); color: inherit; }
.stage-doc::after { content: ' →'; }
.stage-proof { margin: 22px 0 0; font-family: var(--font-mono); font-size: 12px; color: var(--color-accent-green, #2f6f4f); }
.stage-rail-hold { grid-area: 3 / 1; margin: 0; font-size: 15px; opacity: 0.7; }
.stage-rail-close { grid-area: 2 / 1 / span 2; }
.stage-ledger { list-style: none; margin: 0 0 22px; padding: 0; }
.stage-ledger li { display: flex; align-items: center; gap: 14px; padding: 11px 0; border-bottom: 1px solid var(--color-border); font-size: 17px; }
.stage-ledger .stage-check { margin: 0; width: 20px; height: 20px; }
.stage-ledger .stage-doc { margin: 0 0 0 auto; }
.stage-rail-close .stage-claim { font-size: 30px; }
.stage-install { margin-top: 16px; display: flex; align-items: center; gap: 12px; }
.stage-install code { background: var(--color-surface-2, rgba(128,128,128,.12)); padding: 8px 12px; border-radius: 8px; font-size: 13px; }
.stage-install-cta { font-size: 13px; font-weight: 600; text-decoration: none; }
.stage-trust { margin: 12px 0 0; font-size: 12px; opacity: 0.5; }
```
Use the token names that exist in `libs/design-tokens/src/lib/theme.css` (grep `--font-serif`, `--font-mono`, `--color-border`, `--color-text-secondary`, and an accent green; if there is no green token, use the literal `#2f6f4f` used by the Reliability live badge and say so). Style-contract cases: `.stage-seg[data-beat-state='now']` has a `::before` background; `.stage-check[data-checked]` has a background; `.stage-rail-close` spans two rows.

- [ ] **Step 4: Run** `npx vitest run Stage style-contracts use-stage-publisher stage-beats` — PASS; eslint clean; `rm -rf apps/website/.next && npx nx build website` compiles.

- [ ] **Step 5: Commit** `feat(website): the stage rail is a completeness ledger — segments, checks, one claim, one link, one proof`

---

### Task 6: The stills

**Files:** modify `apps/website/src/components/landing/StageStills.tsx`, `StageStills.spec.tsx`.

- [ ] **Step 1: Failing test** — replace the row/CTA assertions: each beat article has `.stage-claim` = `STAGE_RAIL[i].claim`, a `.stage-doc` with the docs href, a `[data-stage-proof]` with the proof; after the four articles a `[data-testid="stage-stills-close"]` with four `.stage-ledger li`, the close claim, the install code, and the cta href.

- [ ] **Step 2: Implement** — `StageStills({ proof })` renders per article: the picture, then `<div className="stage-still-text"><span className="stage-check" data-checked aria-hidden="true" /><div><h3 className="stage-claim">{b.claim}</h3><Link href={b.docs.href} className="stage-doc">{b.docs.label}</Link><p className="stage-proof" data-stage-proof>{proof[b.beat]}</p></div></div>`; after the list, the same close block as the act (`data-testid="stage-stills-close"`, links focusable here). Stills' checks are always filled (the still IS the settle). CSS: `.stage-still-text { display: flex; gap: 14px; align-items: flex-start; }` and reuse the rest.

- [ ] **Step 3: Run** `npx vitest run StageStills` — PASS. **Commit** `feat(website): stage stills carry the ledger`

---

### Task 7: e2e, harness, verification, PR

**Files:** modify `apps/website/e2e/home-stage.spec.ts`.

- [ ] **Step 1: e2e** — in test 2 replace the cue assertions with: at 5% the Tools segment has `data-beat-state="now"` and its beat block's check has no `data-checked`; at 30% Tools is `done` and checked; at 68% `[data-testid=stage-rail-hold]` opacity ≥ 0.5 and `data-sc-verify-hold="true"`; at 100% `[data-testid=stage-rail-close]` opacity is `1`, four `[data-stage-check][data-checked]` inside it, and the install code text equals the first line of `INSTALL_OPTIONS[0].command` (import from `../src/lib/positioning`). New test: clicking the Persist segment (use `page.locator('[data-stage-segment="persist"]').click({ force: true })` because of `tabIndex=-1`? no — click works on any element; force is not needed) scrolls the act so `--sc-p` lands inside the persist window within 1.5 s (`expect.poll`). Keep the live-frame test as is. Run `npx nx e2e website -- --grep "homepage stage"` → all pass; twice.

- [ ] **Step 2: Harness** — free 4308, then:
```
(npx nx serve website --configuration=production --port=4308 --skip-nx-cache > <scratch>/serve.log 2>&1 &)
until curl -sf http://127.0.0.1:4308/ > /dev/null; do sleep 2; done
ln -sfn ../../../apps/website/content dist/apps/website/content
node apps/website/e2e/scroll-craft/verify-home.mjs --url http://127.0.0.1:4308 --out <scratch>/stage-shots
```
Expect "no dead scroll detected" and every cue peaking; read `desktop/sheet.png` and confirm the segments, the checks filling, the hold line, and the ledger ending. Kill the server.

- [ ] **Step 3: Everything**
```
npx nx test website
npx nx lint website 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E "problems|error  "
npx nx build website 2>&1 | grep -iE "error|compiled|failed" | head
npx nx e2e website -- --grep "homepage stage|homepage hero|landing page"
```

- [ ] **Step 4: PR** — push `blove/stage-rail-redesign`, `gh pr create` titled `feat(website): the stage rail is a completeness ledger` with a body covering why (busy, restating, no takeaway), what (segments, check+claim+link+proof, one hold line, the ledger ending, proof derived from the recording, beat one reframed as tool calls and citations), and tests; end with the Claude Code footer; `gh pr merge --auto --squash`. After merge and deploy: `STAGE_LIVE_FRAME=true BASE_URL=https://threadplane.ai npx playwright test apps/website/e2e/home-stage.spec.ts --config apps/website/playwright.config.ts` → all pass.

---

## Self-review

**Spec coverage:** §3.1 segment bar (Tasks 3–5: states from progress, click navigation, replaces the eyebrow); §3.2 beat block (Task 5 markup, Task 4 check fill at `settleAt`, links `tabIndex=-1`); §3.3 hold (Task 1 single line, Task 5 `holdCue()`); §3.4 ending (Task 5 `closeCue()` meeting the render settle, ledger, claim, install, cta, trust line); §4 proof (Task 2, omitted-not-defaulted, spec pins shapes, props from the server page); §5 copy (Task 1, keys unchanged); §6 stills (Task 6); §7 verification (Task 7 incl. the harness and the word budget in Task 1).

**Placeholder scan:** `<keep>` in Task 1 means "copy the existing string verbatim" and is stated so. The A2UI component-count key is stated as "count objects carrying a `component` key" with an instruction to verify against the take; the sources count has the same verify instruction. No TBDs.

**Type consistency:** `StageRailBeat` fields (`label`, `claim`, `docs`, `stillAlt`) are what Tasks 5–6 read; `settleAt`/`segmentState`/`isChecked` (Task 3) are what Task 4 calls; `data-stage-segment`/`data-stage-check`/`data-beat-state`/`data-checked` are the attributes Tasks 4, 5, 6, 7 share; `proof: Record<StageBeat, string>` flows page → Stage → StageAct/StageStills; `holdCue()` and `closeCue()` replace `holdLineCues` everywhere (Task 5 deletes the old export and its spec cases).
