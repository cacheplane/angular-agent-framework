# AG-UI App-mode promo hero — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder launcher hint in sidebar mode (App mode off) with a preview-led marketing hero that sells the App-mode cockpit and the Threadplane primitives, with a CTA that enables App mode.

**Architecture:** A new isolated standalone `AppModePromoComponent` (signal `hasMapsKey` input + `enable` output) renders a centered poster card: a static Paris map image backdrop with an always-dark caption bar (eyebrow, headline, four Threadplane pills, CTA). `SidebarMode` renders it in place of the hint, wiring the shell's `hasMapsKey` and `onAppModeChange('on')`. The map image is a user-provided screenshot committed to `public/`; a dark fallback background keeps the card intact until it lands.

**Tech Stack:** Angular 21 (standalone, zoneless, signals, OnPush), Material Symbols Outlined icons (ligatures), vitest + TestBed (unit), Playwright (e2e), `sips` (image processing). Spec: `docs/superpowers/specs/2026-06-25-ag-ui-app-mode-promo-design.md`.

---

## File Structure

- Create: `examples/ag-ui/angular/src/app/modes/app-mode-promo.component.ts` — the hero component (template + styles inline, matching `itinerary-panel.component.ts` style).
- Create: `examples/ag-ui/angular/src/app/modes/app-mode-promo.component.spec.ts` — unit tests.
- Modify: `examples/ag-ui/angular/src/app/modes/sidebar-mode.component.ts` — render the promo instead of the hint; drop the now-dead `.sidebar-mode__hint` style.
- Create: `examples/ag-ui/angular/e2e/app-mode-promo.spec.ts` — e2e (promo visible in sidebar mode, key-independent assertions).
- Add (asset, when provided): `examples/ag-ui/angular/public/app-mode-preview.webp` — processed from the user's `app-mode-preview-raw.png`.

---

## Task 1: AppModePromoComponent (TDD)

**Files:**
- Create: `examples/ag-ui/angular/src/app/modes/app-mode-promo.component.ts`
- Test: `examples/ag-ui/angular/src/app/modes/app-mode-promo.component.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `examples/ag-ui/angular/src/app/modes/app-mode-promo.component.spec.ts`:

```ts
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { AppModePromoComponent } from './app-mode-promo.component';

function setup(hasMapsKey: boolean) {
  TestBed.configureTestingModule({ imports: [AppModePromoComponent] });
  const fixture = TestBed.createComponent(AppModePromoComponent);
  fixture.componentRef.setInput('hasMapsKey', hasMapsKey);
  fixture.detectChanges();
  return fixture;
}

describe('AppModePromoComponent', () => {
  it('renders the headline, four capability pills, and the CTA', () => {
    const el: HTMLElement = setup(true).nativeElement;
    expect(el.textContent).toContain('See your trip come alive on a live map');
    expect(el.querySelectorAll('.promo__pill').length).toBe(4);
    const cta = el.querySelector<HTMLButtonElement>('.promo__cta');
    expect(cta).toBeTruthy();
    expect(cta!.disabled).toBe(false);
  });

  it('emits enable when the CTA is clicked', () => {
    const fixture = setup(true);
    let emitted = 0;
    fixture.componentInstance.enable.subscribe(() => (emitted += 1));
    fixture.nativeElement.querySelector<HTMLButtonElement>('.promo__cta')!.click();
    expect(emitted).toBe(1);
  });

  it('disables the CTA and shows the key note when hasMapsKey is false', () => {
    const el: HTMLElement = setup(false).nativeElement;
    const cta = el.querySelector<HTMLButtonElement>('.promo__cta');
    expect(cta!.disabled).toBe(true);
    expect(el.textContent).toContain('GOOGLE_MAPS_API_KEY');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test examples-ag-ui-angular`
Expected: FAIL — cannot resolve `./app-mode-promo.component` (module does not exist yet).

- [ ] **Step 3: Write the component**

Create `examples/ag-ui/angular/src/app/modes/app-mode-promo.component.ts`:

```ts
// SPDX-License-Identifier: MIT
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Marketing hero shown in sidebar mode while App mode is off. Sells the
 * App-mode map cockpit and the Threadplane primitives behind it, with a CTA
 * that enables App mode.
 *
 * Isolated contract — no shell coupling:
 *  - `hasMapsKey`: whether GOOGLE_MAPS_API_KEY is configured (gates the CTA).
 *  - `enable`: emitted when the user clicks the CTA.
 */
@Component({
  selector: 'app-mode-promo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="promo">
      <img
        class="promo__img"
        src="/app-mode-preview.webp"
        alt="Preview of the App-mode map cockpit"
        loading="lazy"
      />
      <div class="promo__caption">
        <div class="promo__copy">
          <span class="promo__eyebrow">
            <span class="promo__icon promo__icon--sm" aria-hidden="true">layers</span>
            Built with Threadplane
          </span>
          <h2 class="promo__title">See your trip come alive on a live map</h2>
          <p class="promo__subtitle">A map cockpit where the agent edits your itinerary in real time.</p>
          <ul class="promo__pills">
            <li class="promo__pill"><span class="promo__icon promo__icon--sm" aria-hidden="true">build</span>Client tools</li>
            <li class="promo__pill"><span class="promo__icon promo__icon--sm" aria-hidden="true">widgets</span>Generative UI</li>
            <li class="promo__pill"><span class="promo__icon promo__icon--sm" aria-hidden="true">how_to_reg</span>Human-in-the-loop</li>
            <li class="promo__pill"><span class="promo__icon promo__icon--sm" aria-hidden="true">database</span>Shared state</li>
          </ul>
        </div>
        <div class="promo__action">
          <button
            type="button"
            class="promo__cta"
            [disabled]="!hasMapsKey()"
            [attr.title]="hasMapsKey() ? null : 'Set GOOGLE_MAPS_API_KEY to enable'"
            (click)="enable.emit()"
          >
            <span class="promo__icon" aria-hidden="true">map</span>
            Enable app mode
            <span class="promo__icon" aria-hidden="true">arrow_forward</span>
          </button>
          @if (!hasMapsKey()) {
            <p class="promo__note">Set <code>GOOGLE_MAPS_API_KEY</code> to enable</p>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .promo {
      position: relative;
      width: min(780px, 100%);
      margin: 0 auto;
      aspect-ratio: 16 / 10;
      border-radius: var(--ngaf-chat-radius-card, 12px);
      overflow: hidden;
      background: #0e1626;
      border: 1px solid var(--ngaf-chat-separator, rgba(255, 255, 255, 0.12));
      animation: promo-rise 320ms ease both;
    }
    .promo__img {
      position: absolute; inset: 0;
      width: 100%; height: 100%;
      object-fit: cover; display: block;
    }
    .promo__caption {
      position: absolute; left: 0; right: 0; bottom: 0;
      display: flex; flex-wrap: wrap; align-items: center; gap: 16px;
      padding: 16px 20px;
      background: rgba(8, 15, 28, 0.96);
      border-top: 1px solid rgba(255, 255, 255, 0.12);
    }
    .promo__copy { flex: 1 1 320px; min-width: 0; }
    .promo__eyebrow {
      display: inline-flex; align-items: center; gap: 6px;
      background: rgba(37, 99, 235, 0.18); color: #93b4f5;
      font-size: 12px; padding: 3px 10px; border-radius: 8px; margin-bottom: 9px;
    }
    .promo__title { font-size: 20px; font-weight: 600; color: #f2f5fb; line-height: 1.3; margin: 0 0 4px; }
    .promo__subtitle { font-size: 13px; color: #9aa6bd; line-height: 1.5; margin: 0 0 12px; }
    .promo__pills { display: flex; flex-wrap: wrap; gap: 8px; list-style: none; margin: 0; padding: 0; }
    .promo__pill {
      display: inline-flex; align-items: center; gap: 6px;
      background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.1);
      color: #c2cbdc; font-size: 12px; padding: 5px 10px; border-radius: 8px;
    }
    .promo__action { flex: 0 0 auto; display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
    .promo__cta {
      display: inline-flex; align-items: center; gap: 8px;
      background: var(--ngaf-chat-primary, #2563eb); color: var(--ngaf-chat-on-primary, #fff);
      border: none; font: inherit; font-size: 14px; font-weight: 600;
      padding: 11px 18px; border-radius: 8px; cursor: pointer;
    }
    .promo__cta:disabled { opacity: 0.5; cursor: not-allowed; }
    .promo__note { font-size: 12px; color: #9aa6bd; margin: 0; }
    .promo__note code { font-family: var(--ngaf-chat-font-mono, monospace); }
    .promo__icon { font-family: 'Material Symbols Outlined', sans-serif; font-size: 18px; line-height: 1; }
    .promo__icon--sm { font-size: 15px; }
    @keyframes promo-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .promo { animation: none; } }
  `],
})
export class AppModePromoComponent {
  /** Whether GOOGLE_MAPS_API_KEY is configured; gates the CTA. */
  readonly hasMapsKey = input<boolean>(false);
  /** Emitted when the user clicks the "Enable app mode" CTA. */
  readonly enable = output<void>();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test examples-ag-ui-angular`
Expected: PASS — the three `AppModePromoComponent` tests pass alongside the existing suite.

- [ ] **Step 5: Commit**

```bash
git add examples/ag-ui/angular/src/app/modes/app-mode-promo.component.ts examples/ag-ui/angular/src/app/modes/app-mode-promo.component.spec.ts
git commit -m "feat(ag-ui): App-mode promo hero component"
```

---

## Task 2: Wire the promo into SidebarMode

**Files:**
- Modify: `examples/ag-ui/angular/src/app/modes/sidebar-mode.component.ts`

- [ ] **Step 1: Replace the hint with the promo in the template**

In `sidebar-mode.component.ts`, replace this block:

```html
      <div class="sidebar-mode__background">
        <!-- In App mode the map is the background; this placeholder hint would
             float unreadably over it, so only show it in plain sidebar mode. -->
        @if (shell.appMode() !== 'on') {
          <p class="sidebar-mode__hint">
            Use the launcher (right edge) to dismiss or re-open the chat panel.
          </p>
        }
      </div>
```

with:

```html
      <div class="sidebar-mode__background">
        <!-- Plain sidebar mode (App mode off): market the App-mode cockpit and
             the Threadplane primitives, with a CTA to turn it on. -->
        @if (shell.appMode() !== 'on') {
          <app-mode-promo
            [hasMapsKey]="shell.hasMapsKey"
            (enable)="shell.onAppModeChange('on')"
          />
        }
      </div>
```

- [ ] **Step 2: Import the component**

In `sidebar-mode.component.ts`, add the import near the other imports:

```ts
import { AppModePromoComponent } from './app-mode-promo.component';
```

and add `AppModePromoComponent` to the `@Component({ imports: [...] })` array (alongside `ChatSidebarComponent`, `WelcomeSuggestionsComponent`).

- [ ] **Step 3: Remove the now-dead hint style**

In the same file's `styles`, delete the `.sidebar-mode__hint` rule if present (the `.sidebar-mode__background` centering rule stays — it now centers the promo card). If no `.sidebar-mode__hint` rule exists, skip.

- [ ] **Step 4: Verify it builds**

Run: `npx nx build examples-ag-ui-angular --configuration=development`
Expected: "Application bundle generation complete." with no errors.

- [ ] **Step 5: Commit**

```bash
git add examples/ag-ui/angular/src/app/modes/sidebar-mode.component.ts
git commit -m "feat(ag-ui): render App-mode promo in sidebar mode"
```

---

## Task 3: e2e — promo is shown in sidebar mode

The CTA's enabled/clickable state depends on a Maps key (absent in CI), so the e2e asserts only key-independent facts: the promo renders with its headline and four pills in plain sidebar mode. The CTA emit is covered by the unit test (Task 1); the full click→cockpit path is covered by live-smoke (Task 5).

**Files:**
- Create: `examples/ag-ui/angular/e2e/app-mode-promo.spec.ts`

- [ ] **Step 1: Write the e2e test**

Create `examples/ag-ui/angular/e2e/app-mode-promo.spec.ts`:

```ts
// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { openDemo } from './test-helpers';

// In sidebar mode with App mode off, the left area shows a marketing hero for
// App mode (not the old launcher hint). A direct /sidebar URL bounces to /embed
// on first load (the shell persist effect's route-relative navigate), so we
// reach sidebar mode by clicking the toolbar "Sidebar" button after load.
test('sidebar mode shows the App-mode promo with the Threadplane pills', async ({ page }) => {
  await openDemo(page, '/');

  await page
    .locator('.ag-ui-shell__segmented-button')
    .filter({ hasText: 'Sidebar' })
    .click();

  const promo = page.locator('app-mode-promo');
  await expect(promo).toBeVisible();
  await expect(promo).toContainText('See your trip come alive on a live map');
  await expect(promo.locator('.promo__pill')).toHaveCount(4);
});
```

- [ ] **Step 2: Run the e2e test**

Ensure the frontend dev server (:4201) and agent (:8000) are running (see Task 5 for the serve commands), then run:

`npx nx e2e examples-ag-ui-angular --grep "App-mode promo"`

Expected: PASS (1 test). If the runner needs the standard port, run the full `npx nx e2e examples-ag-ui-angular` and confirm the new test passes among the suite.

- [ ] **Step 3: Commit**

```bash
git add examples/ag-ui/angular/e2e/app-mode-promo.spec.ts
git commit -m "test(ag-ui): e2e for the App-mode promo in sidebar mode"
```

---

## Task 4: Static map image asset

The component references `/app-mode-preview.webp` and falls back to a dark background (`.promo { background: #0e1626 }`) when the file is absent — so the build and tests are green without it. This task processes the user-provided screenshot into the committed asset.

**Files:**
- Input (user-provided): `examples/ag-ui/angular/public/app-mode-preview-raw.png`
- Add: `examples/ag-ui/angular/public/app-mode-preview.webp`

- [ ] **Step 1: Confirm the raw screenshot is present**

Run: `ls -la examples/ag-ui/angular/public/app-mode-preview-raw.png`
Expected: the file exists. If it does NOT exist yet, STOP this task — the dark fallback keeps everything green; resume when the user drops the screenshot.

- [ ] **Step 2: Resize + convert to webp**

Run:

```bash
cd examples/ag-ui/angular/public
sips -Z 1600 -s format webp app-mode-preview-raw.png --out app-mode-preview.webp
ls -la app-mode-preview.webp
```

Expected: `app-mode-preview.webp` created, max dimension 1600px (aspect preserved; `object-fit: cover` in the component handles final framing), file size well under 300 KB. If `sips` reports webp is unsupported on this macOS, fall back to JPEG (`-s format jpeg --out app-mode-preview.jpg`) and update the `<img src>` in `app-mode-promo.component.ts` to `/app-mode-preview.jpg`.

- [ ] **Step 3: Remove the raw source**

Run: `rm examples/ag-ui/angular/public/app-mode-preview-raw.png`

- [ ] **Step 4: Commit**

```bash
git add examples/ag-ui/angular/public/app-mode-preview.webp
git commit -m "feat(ag-ui): add App-mode promo map background image"
```

---

## Task 5: Verify and ship

**Files:** none (verification + push)

- [ ] **Step 1: Lint**

Run: `npx nx lint examples-ag-ui-angular`
Expected: 0 errors (pre-existing warnings are fine).

- [ ] **Step 2: Unit tests**

Run: `npx nx test examples-ag-ui-angular`
Expected: PASS, including the three `AppModePromoComponent` tests.

- [ ] **Step 3: Build + re-inject the Maps key**

The `inject-env` Nx target rewrites `generated-keys.local.ts` with an empty key on a keyless build, so re-inject after building:

```bash
npx nx build examples-ag-ui-angular --configuration=development
export GOOGLE_MAPS_API_KEY="$(grep -E '^GOOGLE_MAPS_API_KEY=' /Users/blove/repos/angular-agent-framework/.env | head -1 | cut -d= -f2- | tr -d '"')"
GOOGLE_MAPS_API_KEY="$GOOGLE_MAPS_API_KEY" node examples/ag-ui/angular/scripts/inject-env.mjs
```

Expected: build green; "wrote generated-keys.local.ts (key length: 39)".

- [ ] **Step 4: Live-smoke the full click-through (with the local key)**

Start the servers if not running:

```bash
# agent (:8000) — OPENAI_API_KEY only, AG_UI_INTERNAL_TOKEN unset
cd examples/ag-ui/python && env -u AG_UI_INTERNAL_TOKEN OPENAI_API_KEY="$(grep -E '^OPENAI_API_KEY=' /Users/blove/repos/angular-agent-framework/.env | head -1 | cut -d= -f2- | tr -d '"')" uv run uvicorn src.server:app --port 8000 &
# frontend (:4201) — with the Maps key
cd /Users/blove/repos/angular-agent-framework/.claude/worktrees/ag-ui-app-mode-mapfix && GOOGLE_MAPS_API_KEY="$GOOGLE_MAPS_API_KEY" npx nx serve examples-ag-ui-angular --port 4201 &
```

Then in the browser (DOM probes, not screenshots — the WebGL map doesn't capture in the harness):
1. Load `/`, click the "Sidebar" toolbar button → confirm `app-mode-promo` is visible and its CTA is **enabled** (key present).
2. Click the CTA → confirm `appMode` flips on: `.ag-ui-shell__app-body` present, `app-map-canvas` mounted, `app-itinerary-panel.ag-ui-shell__itinerary-overlay` present, and the promo is gone.
3. Reload → confirm it stays in the cockpit (`/sidebar?appmode=on`, not bounced to embed).

Expected: all three hold.

- [ ] **Step 5: Push to PR #736**

```bash
git push origin worktree-ag-ui-app-mode-mapfix
```

Expected: branch updated; PR #736 reflects the promo commits.

---

## Self-Review notes

- **Spec coverage:** component + isolated input/output (Task 1); placement under the existing gate + dead-style removal (Task 2); static image asset with dark fallback + processing (Task 4); CTA→enable→cockpit and no-key disable+note (Tasks 1, 5); responsive wrap + a11y/motion (CSS in Task 1); tests (Tasks 1, 3, 5). All spec sections map to a task.
- **No stale hint assertions:** grep confirmed only the component sources reference the old hint copy — no test updates needed. `examples/chat` keeps its own hint (App mode is AG-UI-only); not touched.
- **Type consistency:** `hasMapsKey` (input) and `enable` (output) names are identical across the component, its spec, and the `SidebarMode` template binding. CSS class names (`.promo__pill`, `.promo__cta`) match between component, unit test, and e2e.
