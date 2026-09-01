# Cockpit Run Discoverability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the cockpit's mode rail read as a switch — Run always the landing view, the four modes visually grouped and legible, and Run carrying a live runtime phase dot — while re-scoping the Activity dot so the two dots make distinct claims.

**Architecture:** Four independent slices over the existing control plane. `activeMode` stops being a persisted preference and becomes local shell state. Rail legibility is pure CSS over DOM hooks that already exist. `ControlPlaneRailItem` in `@threadplane/ui-react` gains a generic status-dot slot, which the cockpit wires to `runtimeSnapshot.phase` for Run and to an unseen-error count for Activity.

**Tech Stack:** Next.js (App Router) + React 19, TypeScript, Nx, Vitest + Testing Library (jsdom), plain CSS with `--ds-*` design tokens.

**Spec:** `docs/superpowers/specs/2026-08-31-cockpit-run-discoverability-design.md`

**Test commands:**

```bash
npx nx test ui-react
```

```bash
npx nx test cockpit
```

Both must be green before the final task is considered done. If this worktree has never installed dependencies, run `npm ci` once first (never `npm install`, never hand-copy packages).

---

## File Structure

| File | Responsibility | Change |
| --- | --- | --- |
| `libs/ui-react/src/lib/control-plane/control-plane-preferences.ts` | Persisted control-plane preferences | Drop `activeMode` from the stored shape and the hook |
| `libs/ui-react/src/lib/control-plane/control-plane.tsx` | Presentational control-plane primitives | `ControlPlaneRailItem` gains `status` + `statusLabel` |
| `apps/cockpit/src/components/cockpit-shell.tsx` | Cockpit page shell, owns mode + activity state | Mode as local state; track the activity seen-marker |
| `apps/cockpit/src/components/control-plane/cockpit-control-plane.tsx` | Cockpit's rail + pane composition | Map phase → Run dot; map unseen errors → Activity dot |
| `apps/cockpit/src/components/control-plane/activity-panel.tsx` | Activity log panel | `attention` reinterpreted as unseen errors |
| `apps/cockpit/src/lib/runtime/runtime-state.ts` | Runtime phase model | Add `runtimeRailStatus(phase)` |
| `apps/cockpit/src/app/cockpit.css` | Cockpit control-plane styling | Contrast, group rule, `VIEW` cap, dot variants, working token |

---

## Task 1: Mode stops being sticky

Every capability opens in Run. `activeMode` leaves persisted preferences entirely.

**Files:**
- Modify: `libs/ui-react/src/lib/control-plane/control-plane-preferences.ts`
- Modify: `apps/cockpit/src/components/cockpit-shell.tsx`
- Test: `libs/ui-react/src/lib/control-plane/control-plane-preferences.spec.ts`
- Test: `apps/cockpit/src/components/cockpit-shell.spec.tsx`

- [ ] **Step 1: Write the failing test**

Add to `libs/ui-react/src/lib/control-plane/control-plane-preferences.spec.ts`:

```ts
it('ignores a stored activeMode and never writes one back', () => {
  window.localStorage.setItem(
    CONTROL_PLANE_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      docs: { expanded: {} },
      cockpit: { activeMode: 'Code', expanded: { Capability: false } },
    }),
  );

  const parsed = readControlPlanePreferences(window.localStorage);

  expect('activeMode' in parsed.cockpit).toBe(false);
  expect(parsed.cockpit.expanded.Capability).toBe(false);
});
```

This spec drives `window.localStorage` directly and clears it in `beforeEach` — there is
no fake-storage helper to reuse. `CONTROL_PLANE_STORAGE_KEY` and
`readControlPlanePreferences` are already imported at the top of the file.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test ui-react -- -t "ignores a stored activeMode"`
Expected: FAIL — `expect(true).toBe(false)`, because `readControlPlanePreferences` still
copies `activeMode` through.

- [ ] **Step 3: Remove `activeMode` from the persisted shape**

In `control-plane-preferences.ts`:

Change the interface:

```ts
export interface ControlPlanePreferencesV1 {
  version: 1;
  docs: {
    expanded: Record<string, boolean>;
  };
  cockpit: {
    expanded: Record<string, boolean>;
  };
}
```

Change the defaults:

```ts
const DEFAULT_PREFERENCES: ControlPlanePreferencesV1 = {
  version: 1,
  docs: { expanded: { Learn: true, Environment: false } },
  cockpit: {
    expanded: { Capability: true, Environment: true },
  },
};
```

Change `cloneDefaults`:

```ts
const cloneDefaults = (): ControlPlanePreferencesV1 => ({
  version: 1,
  docs: { expanded: { ...DEFAULT_PREFERENCES.docs.expanded } },
  cockpit: { expanded: { ...DEFAULT_PREFERENCES.cockpit.expanded } },
});
```

In `readControlPlanePreferences`, drop the `activeMode` branch from the returned object:

```ts
      cockpit: {
        expanded: booleanRecord(cockpit.expanded, defaults.cockpit.expanded),
      },
```

Delete the now-unused `isMode` helper. **Keep** `MODES`, `ControlPlaneMode` and
`parseControlPlaneMode` — the shell still uses them for `?mode=` deep links.

Delete the `setActiveMode` callback entirely, and change the hook's return to:

```ts
  return {
    hydrated,
    expanded: preferences[surface].expanded,
    setExpanded,
  };
```

Note `surface` is still read by `setExpanded`, so it stays a parameter.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test ui-react -- -t "ignores a stored activeMode"`
Expected: PASS

- [ ] **Step 5: Fix the rest of the preferences suite**

Run: `npx nx test ui-react`
Expected: several existing assertions fail — they set and read `activeMode`
(around lines 23, 36, 46, 80, 82, 104, 112, 122, 135, 143, 164 of the spec).

Delete the assertions and fixture fields that concern `activeMode` and
`setActiveMode`. Keep every `expanded` assertion untouched. The test named for
docs-surface mode pinning (which asserted `activeMode` is `'Docs'` on the docs surface)
no longer has a subject — delete it.

Re-run until green.

- [ ] **Step 6: Move mode into the shell**

In `apps/cockpit/src/components/cockpit-shell.tsx`:

Add to the existing `useState` block near `isSidebarOpen`:

```tsx
  const [activeMode, setActiveMode] = useState<ControlPlaneMode>('Run');
```

Delete this line further down:

```tsx
  const activeMode: ControlPlaneMode = preferences.activeMode;
```

Replace the query-param effect with one that no longer waits on hydration:

```tsx
  useEffect(() => {
    if (queryHandled.current) return;
    queryHandled.current = true;
    const url = new URL(window.location.href);
    const rawMode = url.searchParams.get('mode');
    const requestedMode = parseControlPlaneMode(rawMode);
    if (requestedMode) setActiveMode(requestedMode);
    if (rawMode !== null) {
      url.searchParams.delete('mode');
      window.history.replaceState(
        window.history.state,
        '',
        url.pathname + url.search + url.hash
      );
    }
  }, []);
```

The effect runs only on the client after mount, so the server-rendered Run markup and the
first client render agree — `?mode=code` swaps in on the second render, not during
hydration.

In `handleModeChange`, swap the setter and drop `preferences` from the dependency array:

```tsx
  const handleModeChange = useCallback(
    (mode: ControlPlaneMode) => {
      if (mode === activeMode) return;
      setActiveMode(mode);
      appendActivity(
        createLocalActivityInput(entry.topic, {
          kind: 'mode_changed',
          mode,
        })
      );
      track('cockpit:mode_switched', {
        capability: entry.topic,
        from_mode: MODE_ANALYTICS[activeMode],
        to_mode: MODE_ANALYTICS[mode],
      });
    },
    [activeMode, appendActivity, entry.topic]
  );
```

`preferences` is still used for `expanded`, `setExpanded` and `hydrated` — leave the
`useControlPlanePreferences('cockpit')` call in place.

- [ ] **Step 7: Run the cockpit suite**

Run: `npx nx test cockpit`
Expected: failures in `cockpit-shell.spec.tsx` around lines 96, 107 and 195, which seed
and assert `cockpit.activeMode` in `localStorage`.

Rewrite those so that:
- the seeding helper no longer takes or writes an `activeMode`;
- a test asserts that a stored `activeMode: 'Code'` does **not** change the landing view —
  the shell still renders Run;
- a test asserts `?mode=code` still lands in Code and strips the param from the URL.

Re-run until green.

- [ ] **Step 8: Mutation-check the stickiness test**

Temporarily re-add `activeMode` passthrough in `readControlPlanePreferences` and confirm
the "stored `activeMode` does not change the landing view" test fails. Revert the
mutation. This assertion is about an absence and would pass vacuously if mis-wired.

- [ ] **Step 9: Commit**

```bash
git add libs/ui-react/src/lib/control-plane/control-plane-preferences.ts libs/ui-react/src/lib/control-plane/control-plane-preferences.spec.ts apps/cockpit/src/components/cockpit-shell.tsx apps/cockpit/src/components/cockpit-shell.spec.tsx
git commit -m "fix(cockpit): stop persisting the active mode so every capability opens in Run"
```

---

## Task 2: Rail legibility

**Files:**
- Modify: `apps/cockpit/src/app/cockpit.css`
- Modify: `libs/ui-react/src/lib/control-plane/control-plane.tsx`
- Test: `apps/cockpit/src/components/control-plane/cockpit-control-plane.spec.tsx`

- [ ] **Step 1: Write the failing test**

Add to `cockpit-control-plane.spec.tsx`, copying the disk-read preamble that
`activity-panel.spec.tsx:11-17` already uses (the cwd check matters — Nx runs this suite
from `apps/cockpit`, not the workspace root):

```tsx
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspaceRoot = process.cwd().endsWith('/apps/cockpit')
  ? resolve(process.cwd(), '../..')
  : process.cwd();
const cockpitCss = readFileSync(
  resolve(workspaceRoot, 'apps/cockpit/src/app/cockpit.css'),
  'utf8'
);
```

```tsx
it('separates the mode group from the utilities and lifts resting contrast', () => {
  expect(cockpitCss).toMatch(
    /\[data-control-plane-rail-group="utilities"\][^}]*border-top/
  );
  expect(cockpitCss).not.toMatch(
    /\[data-control-plane-rail-item\]\s*\{[^}]*--ds-text-muted/
  );
});

it('names the mode group without adding a second landmark label', () => {
  renderControlPlane();
  const rail = screen.getByRole('navigation', { name: 'Cockpit modes' });
  const cap = rail.querySelector('[data-control-plane-rail-group-label]');
  expect(cap?.textContent).toBe('View');
  expect(cap?.getAttribute('aria-hidden')).toBe('true');
});
```

`renderControlPlane` is the existing render helper in this spec file.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test cockpit -- -t "separates the mode group"`
Expected: FAIL — no `border-top` on the utilities group, and the item rule still sets
`--ds-text-muted`.

- [ ] **Step 3: Add the group label to the primitive**

In `libs/ui-react/src/lib/control-plane/control-plane.tsx`, extend the rail:

```tsx
export interface ControlPlaneRailProps extends CommonProps {
  label: string;
  primaryLabel?: string;
  primary: ReactNode;
  utilities?: ReactNode;
}

export function ControlPlaneRail({
  label,
  primaryLabel,
  primary,
  utilities,
  className,
}: ControlPlaneRailProps) {
  return (
    <nav aria-label={label} className={className} data-control-plane-rail>
      <div data-control-plane-rail-group="primary">
        {primaryLabel ? (
          <span data-control-plane-rail-group-label aria-hidden="true">
            {primaryLabel}
          </span>
        ) : null}
        {primary}
      </div>
      {utilities ? (
        <div data-control-plane-rail-group="utilities">{utilities}</div>
      ) : null}
    </nav>
  );
}
```

It is `aria-hidden` on purpose: the `nav` already carries `aria-label="Cockpit modes"`, and
a visible duplicate would announce the group twice.

- [ ] **Step 4: Pass the label from the cockpit**

In `apps/cockpit/src/components/control-plane/cockpit-control-plane.tsx`, on the
`<ControlPlaneRail>` element add:

```tsx
        primaryLabel="View"
```

- [ ] **Step 5: Update the CSS**

In `apps/cockpit/src/app/cockpit.css`, change the resting colour of the rail item:

```css
.cockpit-control-plane [data-control-plane-rail-item] {
  position: relative;
  min-height: 48px;
  padding: 6px 2px;
  border: 0;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: var(--ds-text-secondary);
  background: transparent;
  text-decoration: none;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}
```

Then replace the utilities rule and add the cap:

```css
.cockpit-control-plane [data-control-plane-rail-group="utilities"] {
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px solid var(--ds-border);
}
.cockpit-control-plane [data-control-plane-rail-group-label] {
  display: block;
  padding-bottom: 4px;
  color: var(--ds-text-muted);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  text-align: center;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx nx test cockpit -- -t "separates the mode group"`
Run: `npx nx test cockpit -- -t "names the mode group"`
Expected: PASS

- [ ] **Step 7: Run both suites**

Run: `npx nx test ui-react`
Run: `npx nx test cockpit`
Expected: green. `control-plane.spec.tsx` may need a case for `primaryLabel` being
omitted — if a snapshot or structural assertion breaks, update it to reflect the new
optional wrapper.

- [ ] **Step 8: Commit**

```bash
git add libs/ui-react/src/lib/control-plane/control-plane.tsx apps/cockpit/src/components/control-plane/cockpit-control-plane.tsx apps/cockpit/src/app/cockpit.css apps/cockpit/src/components/control-plane/cockpit-control-plane.spec.tsx
git commit -m "feat(cockpit): make the mode rail read as a switch"
```

---

## Task 3: A status-dot slot on rail items

Generic primitive change. No cockpit behaviour yet.

**Files:**
- Modify: `libs/ui-react/src/lib/control-plane/control-plane.tsx`
- Modify: `libs/ui-react/src/index.ts`
- Test: `libs/ui-react/src/lib/control-plane/control-plane.spec.tsx`

- [ ] **Step 1: Write the failing test**

Add to `control-plane.spec.tsx`:

```tsx
it('renders a status dot and folds its label into the accessible name', () => {
  render(
    <ControlPlaneRailItem
      label="Run"
      icon={<svg />}
      status="error"
      statusLabel="runtime error"
    />,
  );
  const button = screen.getByRole('button', { name: 'Run, runtime error' });
  expect(
    button.querySelector('[data-control-plane-rail-status]')?.getAttribute(
      'data-control-plane-rail-status',
    ),
  ).toBe('error');
});

it('renders no status dot when status is omitted', () => {
  render(<ControlPlaneRailItem label="Run" icon={<svg />} />);
  const button = screen.getByRole('button', { name: 'Run' });
  expect(button.querySelector('[data-control-plane-rail-status]')).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test ui-react -- -t "renders a status dot"`
Expected: FAIL — `status` is not a valid prop and no element matches.

- [ ] **Step 3: Implement**

In `control-plane.tsx`, replace `ControlPlaneRailItemProps` and the body of
`ControlPlaneRailItem`:

```tsx
export type ControlPlaneRailStatus = 'success' | 'working' | 'error';

export interface ControlPlaneRailItemProps extends CommonProps {
  label: string;
  icon: ReactNode;
  active?: boolean;
  href?: string;
  onSelect?: () => void;
  iconOnly?: boolean;
  target?: string;
  rel?: string;
  status?: ControlPlaneRailStatus;
  statusLabel?: string;
}

export function ControlPlaneRailItem({
  label,
  icon,
  active = false,
  href,
  onSelect,
  iconOnly = false,
  className,
  target,
  rel,
  status,
  statusLabel,
}: ControlPlaneRailItemProps) {
  const tooltipId = useId();
  const accessibleName = statusLabel ? `${label}, ${statusLabel}` : label;
  const showTooltip = iconOnly || Boolean(statusLabel);
  const content = (
    <>
      <span data-control-plane-rail-icon>{icon}</span>
      {iconOnly ? null : <span data-control-plane-rail-label>{label}</span>}
      {status ? (
        <span data-control-plane-rail-status={status} aria-hidden="true" />
      ) : null}
      {showTooltip ? (
        <span id={tooltipId} role="tooltip" data-control-plane-tooltip>
          {accessibleName}
        </span>
      ) : null}
    </>
  );
  const shared = {
    className,
    'data-control-plane-rail-item': true,
    'data-control-plane-active': active || undefined,
    'aria-label': showTooltip ? accessibleName : undefined,
    'aria-describedby': showTooltip ? tooltipId : undefined,
  } as const;

  if (href) {
    return (
      <a
        {...shared}
        href={href}
        target={target}
        rel={rel}
        aria-current={active ? 'page' : undefined}
        onClick={onSelect}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      {...shared}
      type="button"
      aria-pressed={active}
      onClick={onSelect}
    >
      {content}
    </button>
  );
}
```

A labelled item with a status now gets a hover tooltip too, so the state has a
non-colour, non-screen-reader home.

- [ ] **Step 4: Export the new type**

In `libs/ui-react/src/index.ts`, add `ControlPlaneRailStatus` alongside the existing
`ControlPlaneRailItem` / `ControlPlaneMode` exports, matching the file's existing export
style.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx nx test ui-react`
Expected: PASS, whole suite green.

- [ ] **Step 6: Commit**

```bash
git add libs/ui-react/src/lib/control-plane/control-plane.tsx libs/ui-react/src/lib/control-plane/control-plane.spec.tsx libs/ui-react/src/index.ts
git commit -m "feat(ui-react): add a status dot slot to control plane rail items"
```

---

## Task 4: The runtime phase dot on Run

**Files:**
- Modify: `apps/cockpit/src/lib/runtime/runtime-state.ts`
- Modify: `apps/cockpit/src/components/control-plane/cockpit-control-plane.tsx`
- Modify: `apps/cockpit/src/app/cockpit.css`
- Test: `apps/cockpit/src/lib/runtime/runtime-state.spec.ts`
- Test: `apps/cockpit/src/components/control-plane/cockpit-control-plane.spec.tsx`

- [ ] **Step 1: Write the failing test for the mapping**

Add to `apps/cockpit/src/lib/runtime/runtime-state.spec.ts`:

```ts
describe('runtimeRailStatus', () => {
  it('maps every phase to a rail status', () => {
    expect(runtimeRailStatus('ready')).toEqual({
      kind: 'success',
      label: 'runtime ready',
    });
    expect(runtimeRailStatus('connecting')).toEqual({
      kind: 'working',
      label: 'runtime starting',
    });
    expect(runtimeRailStatus('checking')).toEqual({
      kind: 'working',
      label: 'runtime starting',
    });
    expect(runtimeRailStatus('reloading')).toEqual({
      kind: 'working',
      label: 'runtime starting',
    });
    expect(runtimeRailStatus('unresponsive')).toEqual({
      kind: 'error',
      label: 'runtime error',
    });
    expect(runtimeRailStatus('error')).toEqual({
      kind: 'error',
      label: 'runtime error',
    });
    expect(runtimeRailStatus('invalid_configuration')).toEqual({
      kind: 'error',
      label: 'runtime error',
    });
  });

  it('reports no status when there is no runtime to report on', () => {
    expect(runtimeRailStatus('not_configured')).toBeNull();
  });
});
```

Add `runtimeRailStatus` to the file's existing import from `./runtime-state`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test cockpit -- -t "runtimeRailStatus"`
Expected: FAIL — `runtimeRailStatus is not a function`.

- [ ] **Step 3: Implement the mapping**

Append to `apps/cockpit/src/lib/runtime/runtime-state.ts`:

```ts
import type { ControlPlaneRailItemStatus } from '@threadplane/ui-react';

export function runtimeRailStatus(
  phase: RuntimePhase
): ControlPlaneRailItemStatus | null {
  switch (phase) {
    case 'ready':
      return { kind: 'success', label: 'runtime ready' };
    case 'connecting':
    case 'checking':
    case 'reloading':
      return { kind: 'working', label: 'runtime starting' };
    case 'unresponsive':
    case 'error':
    case 'invalid_configuration':
      return { kind: 'error', label: 'runtime error' };
    case 'not_configured':
      return null;
  }
}
```

`ControlPlaneRailItemStatus` is `{ kind, label }`, exported from `@threadplane/ui-react`
by Task 3. Returning that shape directly means the rail item takes one prop, and a dot
without an accessible label is unrepresentable.

The exhaustive `switch` over `RuntimePhase` with no `default` means a future phase is a
compile error rather than a silently missing dot.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test cockpit -- -t "runtimeRailStatus"`
Expected: PASS

- [ ] **Step 5: Write the failing wiring test**

Add to `cockpit-control-plane.spec.tsx`:

```tsx
it('puts the runtime phase on the Run rail item', () => {
  renderControlPlane({ runtimeSnapshot: runtimeSnapshot('unresponsive') });
  const run = screen.getByRole('button', { name: 'Run, runtime error' });
  expect(
    run
      .querySelector('[data-control-plane-rail-status]')
      ?.getAttribute('data-control-plane-rail-status')
  ).toBe('error');
});

it('shows no dot on Run when no runtime is configured', () => {
  renderControlPlane({
    runtimeSnapshot: runtimeSnapshot('not_configured'),
  });
  const run = screen.getByRole('button', { name: 'Run' });
  expect(run.querySelector('[data-control-plane-rail-status]')).toBeNull();
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx nx test cockpit -- -t "puts the runtime phase"`
Expected: FAIL — no button named `Run, runtime error`.

- [ ] **Step 7: Wire it**

In `cockpit-control-plane.tsx`, add `runtimeRailStatus` to the existing import from
`../../lib/runtime/runtime-state`, then compute it next to `attention`:

```tsx
  const railStatus = runtimeRailStatus(runtimeSnapshot.phase);
```

and change the `primary` mapping so only Run carries it:

```tsx
        primary={MODES.map(({ label, icon: Icon }) => (
          <ControlPlaneRailItem
            key={label}
            label={label}
            icon={<Icon size={18} aria-hidden="true" />}
            active={label === activeMode}
            onSelect={() => selectMode(label)}
            status={label === 'Run' ? railStatus ?? undefined : undefined}
          />
        ))}
```

- [ ] **Step 8: Add the dot styling**

In `apps/cockpit/src/app/cockpit.css`, add the working token to both blocks:

```css
.cockpit-control-plane {
  --cockpit-state-error: #b42318;
  --cockpit-state-success: #1a7a40;
  --cockpit-state-working: #9a6700;
```

```css
[data-theme="dark"] .cockpit-control-plane {
  --cockpit-state-error: #ff6369;
  --cockpit-state-success: #4cc38a;
  --cockpit-state-working: #e0a02f;
}
```

Then add the dot itself, after the rail-label rule:

```css
.cockpit-control-plane [data-control-plane-rail-status] {
  position: absolute;
  top: 7px;
  right: 11px;
  width: 7px;
  height: 7px;
  border: 2px solid var(--ds-surface-tinted);
  border-radius: 999px;
}
.cockpit-control-plane [data-control-plane-rail-status="success"] {
  background: var(--cockpit-state-success);
}
.cockpit-control-plane [data-control-plane-rail-status="working"] {
  background: var(--cockpit-state-working);
}
.cockpit-control-plane [data-control-plane-rail-status="error"] {
  background: var(--cockpit-state-error);
}
```

Steady fills — no `animation`, deliberately.

`position: absolute` is load-bearing, not cosmetic: the dot span is an in-flow child of a
`display:flex; flex-direction:column; gap:4px` container, so left in flow it consumes a
4px gap and nudges the icon and label even at zero size.

Also verify by eye in Task 6: a status on a non-`iconOnly` item now shows a hover tooltip
at `left: calc(100% + 8px)` (`cockpit.css:696-700`), positioning authored for the narrow
icon rail. On the Run item that lands over the adjacent pane. No test covers it.

- [ ] **Step 9: Run tests to verify they pass**

Run: `npx nx test cockpit`
Expected: PASS. Existing tests that query `screen.getByRole('button', { name: 'Run' })`
will now fail wherever the fixture snapshot has a phase other than `not_configured`,
because Run's accessible name has changed. Update those queries to the new name — this is
the intended contract change, not a regression.

- [ ] **Step 10: Mutation-check the no-dot case**

Temporarily change `runtimeRailStatus('not_configured')` to return
`{ kind: 'success', label: 'runtime ready' }` and confirm "shows no dot on Run when no
runtime is configured" fails. Revert. The assertion is an absence and would otherwise pass
vacuously.

- [ ] **Step 11: Commit**

```bash
git add apps/cockpit/src/lib/runtime/runtime-state.ts apps/cockpit/src/lib/runtime/runtime-state.spec.ts apps/cockpit/src/components/control-plane/cockpit-control-plane.tsx apps/cockpit/src/components/control-plane/cockpit-control-plane.spec.tsx apps/cockpit/src/app/cockpit.css
git commit -m "feat(cockpit): show runtime phase on the Run rail item"
```

---

## Task 5: Re-scope the Activity dot to unseen problems

Run owns "what the runtime is doing now". Activity owns "there are problems you haven't
read".

**Files:**
- Modify: `apps/cockpit/src/lib/runtime/session-activity.ts`
- Modify: `apps/cockpit/src/components/cockpit-shell.tsx`
- Modify: `apps/cockpit/src/components/control-plane/cockpit-control-plane.tsx`
- Modify: `apps/cockpit/src/components/control-plane/activity-panel.tsx`
- Test: `apps/cockpit/src/lib/runtime/session-activity.spec.ts`
- Test: `apps/cockpit/src/components/control-plane/cockpit-control-plane.spec.tsx`

- [ ] **Step 1: Write the failing selector test**

Add to `apps/cockpit/src/lib/runtime/session-activity.spec.ts`:

```ts
describe('countUnseenProblems', () => {
  const event = (
    id: string,
    kind: ActivityKind,
    severity: ActivitySeverity
  ): SessionActivityEvent => ({
    id,
    at: '2026-08-31T17:00:00.000Z',
    kind,
    severity,
    capability: 'streaming',
    summary: kind,
  });

  it('counts only error events beyond the seen marker', () => {
    const events = [
      event('a', 'runtime_ready', 'success'),
      event('b', 'mode_changed', 'neutral'),
      event('c', 'runtime_unresponsive', 'error'),
    ];
    expect(countUnseenProblems(events, 0)).toBe(1);
  });

  it('ignores routine activity entirely', () => {
    const events = [
      event('a', 'runtime_ready', 'success'),
      event('b', 'mode_changed', 'neutral'),
    ];
    expect(countUnseenProblems(events, 0)).toBe(0);
  });

  it('ignores errors the user has already seen', () => {
    const events = [
      event('a', 'runtime_unresponsive', 'error'),
      event('b', 'mode_changed', 'neutral'),
    ];
    expect(countUnseenProblems(events, 2)).toBe(0);
  });
});
```

Import `countUnseenProblems`, `ActivityKind`, `ActivitySeverity` and
`SessionActivityEvent` from `./session-activity`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test cockpit -- -t "countUnseenProblems"`
Expected: FAIL — `countUnseenProblems is not a function`.

- [ ] **Step 3: Implement the selector**

Append to `apps/cockpit/src/lib/runtime/session-activity.ts`:

```ts
/**
 * Problems the user has not looked at yet.
 *
 * Errors only: `mode_changed` and `runtime_ready` fire during ordinary use, so
 * counting every unread event would light the indicator from the user's own
 * actions. `seenCount` is a prefix marker over the append-ordered log.
 */
export function countUnseenProblems(
  events: readonly SessionActivityEvent[],
  seenCount: number,
): number {
  return events
    .slice(seenCount)
    .filter((event) => event.severity === 'error').length;
}
```

The reducer appends, so index order is arrival order and a prefix count is a valid marker.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test cockpit -- -t "countUnseenProblems"`
Expected: PASS

- [ ] **Step 5: Track the seen marker in the shell**

In `cockpit-shell.tsx`, add state beside `activityOpenCycle`:

```tsx
  const [seenActivityCount, setSeenActivityCount] = useState(0);
```

Mark everything seen when the Activity utility opens, inside the existing
`handleActiveUtilityChange`:

```tsx
  const handleActiveUtilityChange = useCallback(
    (utility: CockpitUtility) => {
      if (utility === 'activity' && activeUtility !== 'activity') {
        setActivityOpenCycle((cycle) => cycle + 1);
        setSeenActivityCount(events.length);
      }
      setActiveUtility(utility);
    },
    [activeUtility, events.length]
  );
```

Reset the marker when the log is cleared:

```tsx
  const handleClearActivity = useCallback(() => {
    dispatchActivity({ type: 'clear' });
    setSeenActivityCount(0);
  }, []);
```

Compute the count and pass it through. Add `countUnseenProblems` to the existing import
from `../lib/runtime/session-activity`, then inside `controlPlaneProps`:

```tsx
      unseenProblems: countUnseenProblems(events, seenActivityCount),
```

and add `seenActivityCount` to that `useMemo` dependency array.

- [ ] **Step 6: Write the failing behaviour test**

In `cockpit-control-plane.spec.tsx`, **replace** the existing test named
`'renders Activity above Settings with a nonnumeric attention indicator that opening does not clear'`
— its "opening does not clear" premise is exactly what this task inverts:

```tsx
it('flags unseen problems on Activity and clears them when the panel opens', () => {
  renderControlPlane({ unseenProblems: 1 });
  const rail = screen.getByRole('navigation', { name: 'Cockpit modes' });
  const utilities = within(rail).getAllByRole('button').slice(4);
  expect(
    utilities.map((button) => button.getAttribute('aria-label'))
  ).toEqual(['Activity, 1 unread problem', 'Settings']);
  expect(
    document.querySelector('[data-cockpit-activity-attention]')?.textContent
  ).toBe('');
});

it('does not flag Activity when nothing has gone wrong', () => {
  renderControlPlane({ unseenProblems: 0 });
  expect(screen.getByRole('button', { name: 'Activity' })).toBeTruthy();
  expect(
    document.querySelector('[data-cockpit-activity-attention]')
  ).toBeNull();
});
```

`renderControlPlane` builds props from a defaults object in this spec — add
`unseenProblems: 0` to those defaults so every other test keeps compiling.

- [ ] **Step 7: Run test to verify it fails**

Run: `npx nx test cockpit -- -t "flags unseen problems"`
Expected: FAIL — `unseenProblems` is not a prop and the label is still phase-derived.

- [ ] **Step 8: Wire the control plane**

In `cockpit-control-plane.tsx`:

Add to `CockpitControlPlaneProps`:

```tsx
  unseenProblems: number;
```

Destructure `unseenProblems` in the component signature.

Replace the `attention` derivation:

```tsx
  const attention = unseenProblems > 0;
  const activityLabel = attention
    ? `Activity, ${unseenProblems} unread problem${unseenProblems === 1 ? '' : 's'}`
    : 'Activity';
```

Remove `runtimeNeedsAttention` from the import list — `runtimeRailStatus` now covers the
Run dot and nothing else in this file uses it. Leave the function exported from
`runtime-state.ts`; `use-runtime-controller.ts` still uses it.

Everything downstream (`attention` passed to `ActivityPanel`, the
`[data-cockpit-activity-attention]` marker) keeps working unchanged.

- [ ] **Step 9: Update the panel's wording**

In `activity-panel.tsx`, the `attention` prop now means unseen problems. Update the JSDoc-free
prop by renaming the derived label so the list's accessible name matches the new claim:

```tsx
  const label = attention ? 'Activity, unread problems' : 'Activity';
```

Update the matching assertions in `activity-panel.spec.tsx` (around lines 168–184) from
`'Activity, attention required'` to `'Activity, unread problems'`.

- [ ] **Step 10: Run tests to verify they pass**

Run: `npx nx test cockpit`
Expected: PASS. Any remaining `'Activity, attention required'` string assertions must be
updated to the new labels.

- [ ] **Step 11: Mutation-check the quiet case**

Temporarily change `countUnseenProblems` to `events.slice(seenCount).length` (dropping the
severity filter) and confirm "does not flag Activity when nothing has gone wrong" fails
once a `mode_changed` event exists in the fixture. Revert. Without this check the test
passes whether or not the filter is wired.

- [ ] **Step 12: Commit**

```bash
git add apps/cockpit/src/lib/runtime/session-activity.ts apps/cockpit/src/lib/runtime/session-activity.spec.ts apps/cockpit/src/components/cockpit-shell.tsx apps/cockpit/src/components/control-plane/cockpit-control-plane.tsx apps/cockpit/src/components/control-plane/cockpit-control-plane.spec.tsx apps/cockpit/src/components/control-plane/activity-panel.tsx apps/cockpit/src/components/control-plane/activity-panel.spec.tsx
git commit -m "feat(cockpit): re-scope the Activity indicator to unseen problems"
```

---

## Task 6: Verify the whole thing

**Files:** none — verification only.

- [ ] **Step 1: Full suites**

Run: `npx nx test ui-react`
Run: `npx nx test cockpit`
Expected: both green.

- [ ] **Step 2: Lint**

`apps/cockpit` has **no** `lint` target — only `ui-react` does. Run:

```bash
npx nx lint ui-react 2>&1 | sed $'s/\033\\[[0-9;]*m//g' | grep -cE ' error '
```

Expected: `0`.

CI tolerates warnings but fails on errors. Strip ANSI before grepping — a bare
`grep -cE ' error '` silently returns 0 against coloured output.

Note on reading test results: `npx nx test <project>` swallows the vitest reporter output
in this worktree, so it tells you pass/fail but not counts. When you need real numbers, run
`npx vitest run --root apps/cockpit` (or `--root libs/ui-react`) directly.

- [ ] **Step 3: Confirm in a real browser**

Start the cockpit dev server via the Browser pane's `preview_start` (never `Bash`), open a
capability page, and check:
- it lands on Run even though `localStorage` still holds an old `activeMode: "Code"`;
- the rail shows the `VIEW` cap, a rule above Activity/Settings, and legible inactive items;
- Run carries a green dot once the runtime is ready;
- `?mode=code` still deep-links to Code and strips the param.

Check both themes — the dot tokens are defined per theme.

- [ ] **Step 4: Commit anything the browser pass turned up**

```bash
git add -A
git commit -m "fix(cockpit): browser-pass corrections for the rail redesign"
```

Skip if there is nothing to commit.
