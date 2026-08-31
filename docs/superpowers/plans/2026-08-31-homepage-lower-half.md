# Homepage Lower Half Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the established design language to `Promises`, `PilotBlock`, `WhitePaperBlock`, `RecentArticles`, the `DemoShowcase` header, and intent-gate the sitewide `AnnouncementToast` — per `docs/superpowers/specs/2026-08-31-homepage-lower-half-design.md`.

**Architecture:** Next.js 16 / React 19; UNLAYERED CSS in `apps/website/src/styles/landing.css` (toast styles in `chrome.css`); no inline styles, no `@layer`. All devices already exist: `.marker-highlight` (landing.css), the rows grammar (reference `.feature-block-rows` values), ghost numerals (reference `.yes-wall-group-numeral`, light variant), paper elevation (reference `.proof-strip-cell` shadows). Do NOT fork new header anatomies — reuse the feature blocks' railkick pattern (kicker + hairline span) where `SectionHeader` doesn't fit.

**Test command:** `cd apps/website && npx vitest run --config vite.config.mts`
**Known-red baseline:** 7 pre-existing failures in 4 docs-chrome files (main breakage, tracked separately). Green means: no NEW failures; all files this plan touches pass.
**Branch:** `blove/homepage-lower-half`, expected starting HEAD `88587e92` or descendant.

---

### Task 1: Promises ledger

**Files:**
- Modify: `apps/website/src/components/landing/Promises.tsx`
- Modify: `apps/website/src/styles/landing.css`

- [ ] **Step 1: Restructure the component**

Replace the PROMISES data and render with:

```tsx
const PROMISES = [
  { no: 'No runtime lock-in', rest: 'every package is MIT, commercial or not.', tail: 'MIT, all packages' },
  { no: 'No abandoned majors', rest: "Angular's current and previous LTS, always.", tail: 'support policy' },
  { no: 'No required cloud', rest: 'run everything in your own VPC.', tail: 'self-host' },
  { no: 'No hidden telemetry', rest: 'events require an explicit application action.', tail: 'installation is inert' },
  { no: 'No model lock-in', rest: 'swap providers without touching Angular code.', tail: 'any LLM your runtime runs' },
];
```

JSX inside `<Section surface="canvas" ariaLabelledBy="promises-heading">` + `Container`:

```tsx
        <div className="promises-rail">
          <Eyebrow tone="accent" className="promises-eyebrow">
            Built on principles
          </Eyebrow>
          <span className="promises-rail-line" aria-hidden="true" />
          <span className="promises-rail-aside">honest commitments, not aspirations</span>
        </div>
        <h2 id="promises-heading" className="promises-heading">
          What we won&apos;t do.
        </h2>
        <div className="promises-rows">
          {PROMISES.map((p) => (
            <div className="promises-row" key={p.no}>
              <p className="promises-row-claim">
                <span className="marker-highlight">{p.no}</span> — {p.rest}
              </p>
              <p className="promises-row-tail">{p.tail}</p>
            </div>
          ))}
        </div>
```

The old `promises-intro`/`promises-subhead` markup and the Card grid go away;
remove the `Card` import.

- [ ] **Step 2: CSS**

In `landing.css`, find the `/* Promises — ... */` block: delete the
`promises-intro`, `promises-subhead`, `promises-grid`, `promises-card-title`,
`promises-card-desc` (grep `promises-` for the full set) rules; keep/adjust
`promises-eyebrow`, `promises-heading` (left-aligned now: remove any
`text-align: center` and `margin: … auto`), and add:

```css
.promises-rail {
  display: flex;
  align-items: baseline;
  gap: 14px;
}
.promises-rail-line {
  flex: 1;
  height: 1px;
  background: var(--color-border);
}
.promises-rail-aside {
  font-family: var(--font-inter);
  font-size: 14px;
  font-style: italic;
  color: var(--color-text-muted);
  white-space: nowrap;
}
.promises-rows {
  margin-top: 22px;
  border-top: 2px solid var(--color-text-primary);
  max-width: 56ch;
}
.promises-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 16px;
  align-items: baseline;
  border-bottom: 1px solid var(--color-border-soft, var(--color-border));
  padding: 11px 0;
}
.promises-row-claim {
  font-family: var(--font-inter);
  font-size: 15.5px;
  line-height: 1.55;
  color: var(--color-text-primary);
  margin: 0;
}
.promises-row-tail {
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--color-text-muted);
  white-space: nowrap;
  margin: 0;
}
@media (max-width: 640px) {
  .promises-row {
    grid-template-columns: 1fr;
    gap: 2px;
  }
  .promises-rail-aside {
    display: none;
  }
}
```

(Write `border-bottom: 1px solid var(--color-border);` — the -soft var does
not exist; shown only to flag the family.)

- [ ] **Step 3: Suite + commit**

Full suite: no new failures. Commit:
```bash
git add apps/website/src
git commit -m "feat(website): Promises becomes a marker-swept ledger"
```

---

### Task 2: PilotBlock rows + specimen numerals

**Files:**
- Modify: `apps/website/src/components/landing/PilotBlock.tsx`
- Modify: `apps/website/src/styles/landing.css`

- [ ] **Step 1: Component**

Data:
```tsx
const TIMELINE = [
  { phase: '01', title: 'Discover', body: 'Map your stack, surfaces, and the agentic work that earns its keep.' },
  { phase: '02', title: 'Build', body: 'A working demo on your real data, in your real app.' },
  { phase: '03', title: 'Harden', body: 'Observability, error boundaries, deploy paths, on-call patterns.' },
  { phase: '04', title: 'Train', body: 'Your team owns the stack. We leave you with a runbook, not a black box.' },
];
const OUTCOMES = [
  { claim: 'A working agent demo on your domain', tail: 'your data' },
  { claim: 'Hardened error, fallback, observability patterns', tail: 'production-ready' },
  { claim: 'Deploy-ready integration', tail: 'your CI/CD' },
  { claim: 'Team trained on the framework', tail: 'runbook, yours' },
];
```

Left column: eyebrow becomes the railkick pattern:
```tsx
            <div className="pilot-rail">
              <Eyebrow tone="accent" className="pilot-eyebrow">For teams</Eyebrow>
              <span className="pilot-rail-line" aria-hidden="true" />
            </div>
```
Heading + subhead + CTA row unchanged. The `pilot-outcomes` `<ul>` becomes:
```tsx
            <div className="pilot-rows">
              {OUTCOMES.map((o) => (
                <div className="pilot-row" key={o.claim}>
                  <p className="pilot-row-claim">{o.claim}</p>
                  <p className="pilot-row-tail">{o.tail}</p>
                </div>
              ))}
            </div>
```

Right column: the Card timeline becomes (remove the `Card` import):
```tsx
          <div className="pilot-steps">
            {TIMELINE.map((t) => (
              <div className="pilot-step" key={t.phase}>
                <span className="pilot-step-num" aria-hidden="true">{t.phase}</span>
                <div>
                  <div className="pilot-step-title">{t.title}</div>
                  <div className="pilot-step-body">{t.body}</div>
                </div>
              </div>
            ))}
          </div>
```

- [ ] **Step 2: CSS**

Delete the old `pilot-timeline*` and `pilot-outcome*` rules (grep `pilot-`
for the block; keep `pilot-block-grid`, `pilot-eyebrow`, `pilot-heading`,
`pilot-subhead`, `pilot-cta-row`). Add:

```css
.pilot-rail {
  display: flex;
  align-items: baseline;
  gap: 14px;
}
.pilot-rail-line {
  flex: 1;
  height: 1px;
  background: var(--color-border);
}
.pilot-rows {
  margin: 18px 0 4px;
  border-top: 2px solid var(--color-text-primary);
  max-width: 44ch;
}
.pilot-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 16px;
  align-items: baseline;
  border-bottom: 1px solid var(--color-border);
  padding: 9px 0;
}
.pilot-row-claim {
  font-family: var(--font-inter);
  font-size: 15px;
  line-height: 1.45;
  color: var(--color-text-primary);
  margin: 0;
}
.pilot-row-tail {
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--color-text-muted);
  white-space: nowrap;
  margin: 0;
}
.pilot-steps {
  border-top: 2px solid var(--color-text-primary);
}
.pilot-step {
  display: grid;
  grid-template-columns: 64px 1fr;
  gap: 16px;
  align-items: start;
  padding: 14px 0;
  border-bottom: 1px solid var(--color-border);
}
.pilot-step:last-child {
  border-bottom: none;
}
.pilot-step-num {
  font-family: var(--font-garamond);
  font-size: 44px;
  font-weight: 700;
  line-height: 0.9;
  letter-spacing: -0.03em;
  color: var(--color-border);
}
.pilot-step-title {
  font-family: var(--font-inter);
  font-size: 15.5px;
  font-weight: 600;
  color: var(--color-text-primary);
}
.pilot-step-body {
  font-family: var(--font-inter);
  font-size: 14px;
  line-height: 1.5;
  color: var(--color-text-secondary);
  margin-top: 2px;
}
@media (max-width: 640px) {
  .pilot-row {
    grid-template-columns: 1fr;
    gap: 2px;
  }
}
```

If the old block had a mobile rule collapsing `pilot-block-grid`, keep it.

- [ ] **Step 3: Suite + commit**

```bash
git add apps/website/src
git commit -m "feat(website): PilotBlock rows and specimen-numeral timeline"
```

---

### Task 3: WhitePaperBlock — rows + bare paper card + form spec

**Files:**
- Modify: `apps/website/src/components/landing/WhitePaperBlock.tsx`
- Create: `apps/website/src/components/landing/WhitePaperBlock.spec.tsx`
- Modify: `apps/website/src/styles/landing.css`

- [ ] **Step 1: Write the form spec FIRST (it pins CURRENT behavior — must pass before AND after the visual change)**

```tsx
// apps/website/src/components/landing/WhitePaperBlock.spec.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WhitePaperBlock } from './WhitePaperBlock';

const trackMock = vi.fn();
vi.mock('../../lib/analytics/client', async (importOriginal) => {
  const mod = await importOriginal<Record<string, unknown>>();
  return {
    ...mod,
    track: (...args: unknown[]) => trackMock(...args),
    trackWhitepaperDownloadClick: vi.fn(),
  };
});

describe('WhitePaperBlock', () => {
  beforeEach(() => {
    trackMock.mockClear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  });

  it('submits the email, fires signup analytics, and shows the done state', async () => {
    render(<WhitePaperBlock />);
    fireEvent.change(screen.getByPlaceholderText(/email/i), {
      target: { value: 'dev@example.com' },
    });
    fireEvent.submit(screen.getByRole('button', { name: /download/i }).closest('form')!);
    await waitFor(() => expect(screen.getByText(/Check your inbox/i)).toBeTruthy());
    const events = trackMock.mock.calls.map((c) => c[0]);
    expect(events).toContain('marketing:whitepaper_signup_submit');
    expect(events).toContain('marketing:whitepaper_signup_success');
  });
});
```

BEFORE writing: check the real event-name strings in
`apps/website/src/lib/analytics/events.ts` (grep `whitepaper_signup`) and the
real input placeholder / button label in the component — adapt the literals
to what actually exists, then run the spec against the UNMODIFIED component.
It must PASS. Paste the run line.

- [ ] **Step 2: Rows + paper card**

In `WhitePaperBlock.tsx`:
- Eyebrow becomes the railkick pattern (same as Task 1/2:
  `wp-rail` / `wp-rail-line`).
- Replace the BULLETS array + `wp-bullets` list with rows:
```tsx
const ROWS = [
  { claim: 'Six production-readiness dimensions', tail: '18 pages' },
  { claim: 'Error boundaries, fallbacks, observability, deploy', tail: 'concrete patterns' },
  { claim: 'No vendor pitch — what we learned shipping it', tail: 'free' },
];
```
rendered as `wp-rows`/`wp-row`/`wp-row-claim`/`wp-row-tail` (same structure
as Task 2's rows).
- Replace the `BrowserFrame` wrapper of the cover with a bare paper card,
  keeping the inner cover content EXACTLY as-is:
```tsx
          <div className="wp-cover-wrap" aria-hidden="true">
            <div className="wp-paper">
              <div>
                <div className="wp-cover-badge">Field report · 18 pages</div>
                <div className="wp-cover-title">From Prototype to Production</div>
                <div className="wp-cover-desc">Six production-readiness dimensions for Angular AI teams.</div>
              </div>
              <div className="wp-cover-footer">Threadplane</div>
            </div>
          </div>
```
  Remove the `BrowserFrame` import if now unused in the file.
- The form/states/fetch/analytics: untouched.

- [ ] **Step 3: CSS**

Delete `wp-bullets`/`wp-bullet`/`wp-bullet-dot` rules. Add (reusing Task 1/2
row values — copy them; and treatment-D shadows):

```css
.wp-rail { display: flex; align-items: baseline; gap: 14px; }
.wp-rail-line { flex: 1; height: 1px; background: var(--color-border); }
.wp-rows { margin: 18px 0 4px; border-top: 2px solid var(--color-text-primary); max-width: 42ch; }
.wp-row { display: grid; grid-template-columns: 1fr auto; gap: 16px; align-items: baseline; border-bottom: 1px solid var(--color-border); padding: 9px 0; }
.wp-row-claim { font-family: var(--font-inter); font-size: 15px; line-height: 1.45; color: var(--color-text-primary); margin: 0; }
.wp-row-tail { font-family: var(--font-mono); font-size: 11.5px; color: var(--color-text-muted); white-space: nowrap; margin: 0; }
.wp-paper {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 300px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 26px 24px;
  transform: rotate(-1.2deg);
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.05),
    0 26px 52px -18px rgba(28, 28, 28, 0.28);
}
@media (max-width: 640px) {
  .wp-row { grid-template-columns: 1fr; gap: 2px; }
}
```

Check the existing `wp-cover`/`wp-cover-*` rules: keep the typography rules
(`wp-cover-badge/title/desc/footer`); delete a `wp-cover` layout rule only if
it referenced BrowserFrame internals — otherwise leave.

- [ ] **Step 4: Re-run the form spec (must STILL pass) + full suite + commit**

```bash
git add apps/website/src
git commit -m "feat(website): WhitePaperBlock rows and bare paper cover"
```

---

### Task 4: Rail headers for RecentArticles + DemoShowcase

**Files:**
- Modify: `apps/website/src/components/landing/RecentArticles.tsx`
- Modify: `apps/website/src/components/landing/DemoShowcase.tsx`
- Modify: `apps/website/src/styles/landing.css`

- [ ] **Step 1: RecentArticles**

Header becomes:
```tsx
        <div className="recent-articles-rail">
          <Eyebrow tone="accent" className="recent-articles-eyebrow">Blog</Eyebrow>
          <span className="recent-articles-rail-line" aria-hidden="true" />
          <h2 id="recent-articles-heading" className="recent-articles-heading">
            Recent articles
          </h2>
        </div>
```
(the h2 moves INTO the rail as the right-side aside, styled italic muted —
it keeps its id for the Section's ariaLabelledBy).

- [ ] **Step 2: DemoShowcase**

FIRST check `DemoShowcase.spec.tsx` for assertions on the header (grep
'See it running' / eyebrow / heading in the spec). Convert the
`demo-showcase__eyebrow` `<p>` into the railkick pattern
(`demo-showcase__rail` wrapping the existing eyebrow p + a hairline span);
heading and subhead keep their classes but the block left-aligns. Update any
spec assertions that break, minimally.

- [ ] **Step 3: CSS**

```css
.recent-articles-rail {
  display: flex;
  align-items: baseline;
  gap: 14px;
}
.recent-articles-rail-line { flex: 1; height: 1px; background: var(--color-border); }
.recent-articles-heading {
  font-family: var(--font-inter);
  font-size: 14px;
  font-style: italic;
  font-weight: 400;
  color: var(--color-text-muted);
  margin: 0;
  white-space: nowrap;
}
.demo-showcase__rail { display: flex; align-items: baseline; gap: 14px; }
.demo-showcase__rail-line { flex: 1; height: 1px; background: var(--color-border); }
```

Adjust/remove the old centered rules: `recent-articles-header` (was likely
centered), `demo-showcase__eyebrow` centering, `demo-showcase__heading`
`text-align: center` → left, `demo-showcase__subhead` `margin: 0 auto` →
`margin: 0` (keep its max-width). Grep those class names in landing.css and
fix each centering declaration.

- [ ] **Step 4: Suite (DemoShowcase spec green) + commit**

```bash
git add apps/website/src
git commit -m "refactor(website): rail headers for RecentArticles and DemoShowcase"
```

---

### Task 5: AnnouncementToast scroll gating

**Files:**
- Modify: `apps/website/src/components/shared/AnnouncementToast.tsx`
- Create: `apps/website/src/components/shared/AnnouncementToast.spec.tsx`

- [ ] **Step 1: Write the failing spec**

```tsx
// apps/website/src/components/shared/AnnouncementToast.spec.tsx
import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnnouncementToast } from './AnnouncementToast';

vi.mock('../../lib/analytics/client', () => ({
  track: vi.fn(),
  trackWhitepaperDownloadClick: vi.fn(),
}));

function setScroll(fraction: number) {
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    value: 5000,
    configurable: true,
  });
  Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true });
  window.scrollY = fraction * 5000;
  fireEvent.scroll(window);
}

describe('AnnouncementToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('stays hidden after the timer if the reader has not scrolled 40%', () => {
    render(<AnnouncementToast />);
    act(() => vi.advanceTimersByTime(31_000));
    setScroll(0.1);
    expect(document.querySelector('.toast-root')).toBeNull();
  });

  it('appears once BOTH the timer and the 40% scroll threshold are met', () => {
    render(<AnnouncementToast />);
    act(() => vi.advanceTimersByTime(31_000));
    act(() => setScroll(0.5));
    expect(document.querySelector('.toast-root')).toBeTruthy();
  });
});
```

Adapt selectors/mocks to the component's real render (the `.toast-root` class
exists; if the visible toast requires `visible === true` to render at all,
these assertions hold). rAF throttling: if the implementation defers the
flag behind requestAnimationFrame, stub rAF to run synchronously in the spec
(`vi.stubGlobal('requestAnimationFrame', (cb) => { cb(0); return 0; })`).
Run → the second test FAILS against the current component (it appears on
timer alone... actually the current component shows after the timer with NO
scroll — so test 1 FAILS: the toast IS visible at 0.1 scroll). Either way at
least one test must fail pre-change; paste which.

- [ ] **Step 2: Implement the gate**

In `AnnouncementToast.tsx`, replace the single-condition effect:

```tsx
  const [timerDone, setTimerDone] = useState(false);
  const [scrolledEnough, setScrolledEnough] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === 'true') return;
    } catch {
      return;
    }
    const timer = setTimeout(() => setTimerDone(true), DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  // Intent gate (spec 2026-08-31): the toast waits for BOTH the delay and a
  // 40% scroll depth — it should meet readers who are reading, not arrivals.
  useEffect(() => {
    if (scrolledEnough) return undefined;
    let raf = 0;
    const check = () => {
      raf = 0;
      const doc = document.documentElement;
      const denom = Math.max(1, doc.scrollHeight - window.innerHeight);
      if (window.scrollY / denom >= 0.4) {
        setScrolledEnough(true);
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    check();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [scrolledEnough]);

  useEffect(() => {
    if (timerDone && scrolledEnough) setVisible(true);
  }, [timerDone, scrolledEnough]);
```

(`setVisible` and the mounted-transition effect stay; the dismissal path is
untouched. Note the scroll listener detaches once satisfied.)

NOTE the denominator: 40% of the SCROLLABLE range
(`scrollHeight - innerHeight`), not raw scrollHeight — update the spec's
`setScroll` math to match (fraction * (5000 - 1000)) so tests and code agree.

- [ ] **Step 3: Run the toast spec (2/2) + full suite + commit**

```bash
git add apps/website/src
git commit -m "feat(website): intent-gate the announcement toast on scroll depth"
```

---

### Task 6: Verification gate

- [ ] Full suite: no new failures vs the known-red baseline (4 files / 7 docs-chrome tests). Every file this plan touched: green.
- [ ] `npx nx build website --configuration=production` → exit 0.
- [ ] Visual pass (Browser pane, `website-dev`, 1440px + 375px, DOM-first):
  Promises rows with visible marker sweeps; PilotBlock numerals + rows; the
  bare rotated paper card (no browser chrome); rail headers on Articles +
  DemoShowcase; toast does NOT appear after 35s at top of page, DOES appear
  after scrolling past ~40% (drive with JS scroll + fake time not possible
  live — verify by scrolling and waiting; report what you observed).
- [ ] Commit any fixes; stop. No push/PR — separate decision.

## Deviations that require stopping

- DemoShowcase.spec assertions that need more than minimal header updates.
- Any WhitePaperBlock form/analytics behavior change (the spec from Task 3
  step 1 failing after the visual change = STOP and fix the visual change).
