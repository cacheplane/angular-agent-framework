# Render Examples Redesign — Follow-up (5 siblings) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Apply the merged spec-rendering playback redesign to the other 5 `render/*` examples (element-rendering, registry, computed-functions, state-management, repeat-loops), eliminating Tailwind utilities in favor of encapsulated component CSS on `--ds-*` tokens, adding the syntax-colored JSON console, and styling each example's bespoke controls consistently.

**Architecture:** The merged `cockpit/render/spec-rendering/angular/src/app/spec-rendering.component.ts` is the **exemplar** — reuse its scoped-class approach (`.bar/.tabs/.tab/.status/.cap/.json-pane/.json/.json__foot`, the dark JSON console, render-green accent, `sr-skeleton` loader, status pulse) verbatim in style. The shared `json-highlight` tokenizer moves to `cockpit/render/shared/` so all examples import it. Each example additionally gets a consistent **controls panel** style for its unique widgets.

**Tech Stack:** Angular standalone + signals + control-flow, `@threadplane/render`, `@threadplane/design-tokens` (`--ds-*`), shared `StreamingSimulator`/`StreamingTimelineComponent`/`highlightJson`, Vitest. Nx build gate (`nx build <proj> --configuration=production`), no lint target for example apps.

**Reference (read before starting):**
- Exemplar component: `cockpit/render/spec-rendering/angular/src/app/spec-rendering.component.ts`
- Exemplar styles.css: `cockpit/render/spec-rendering/angular/src/styles.css` (the `.sr-skeleton` loader + `--ds-*` body)
- Design spec: `docs/superpowers/specs/2026-07-06-spec-rendering-playback-redesign-design.md`

---

## Shared conventions (apply in every example task)

**Design tokens** — never hardcode canvas/surface/text/border colors; use `--ds-*` (theme-aware). Accent = render-green: `var(--ds-render-green)` for solid fills (light text on top), a local `#35b06a` for on-dark text/glows. The JSON console is pinned to a fixed dark surface (`#0b0b0b`) with a scoped `--code-fg/--code-muted/--code-border` palette, exactly as in the exemplar.

**Per example, replace the component's `template:` + add `styles:` so that:**
1. `[header]` = `.bar` with `.bar__lbl` "Spec", `.tabs`/`.tab`/`.tab--on` segmented pills (render-green active), and a `.status` pulse (`.status__dot`/`--live`) bound to `simulator.playing()` — copy these rules from the exemplar.
2. `[primary]` = `.cap` "Live Render Output" + `<render-spec>` (unchanged bindings) or the placeholder.
3. `[secondary]` = `.json-pane` (dark console) with `.cap` "Streaming JSON", the syntax-colored `<pre class="json" #jsonScroll>` using `jsonTokens()` + `.json__cursor`, and `.json__foot` (state + percent). **Plus** the example's controls panel if it has one (see below).
4. `[footer]` = `<streaming-timeline footer [simulator]="simulator" />` (unchanged).
5. Wire `protected readonly jsonTokens = computed(() => highlightJson(this.simulator.rawJson()));` and the `#jsonScroll` autoscroll `effect` — copy from the exemplar.
6. Restyle the example's inline demo components (`demo-text/heading/card/badge/label/value`) with encapsulated `styles:` on `--ds-*`, using the global `.sr-skeleton` class for loaders — copy the exemplar's demo-component styles and adapt per component.
7. **Zero Tailwind utility classes.** Only plain scoped class names remain.

**The `<pre>` whitespace rule** (critical, from the exemplar): the `<pre class="json" #jsonScroll>@for (tok of jsonTokens(); track $index) {<span [class]="'j-' + tok.kind">{{ tok.text }}</span>}<span class="json__cursor"></span></pre>` line MUST stay on a single physical line with no stray whitespace between `>`/`@for`/`{`/`<span>`/`}`/cursor.

**Controls panel CSS** (add to the `styles:` of the 3 examples that have controls — element-rendering, state-management, repeat-loops):

```css
.controls {
  flex-shrink: 0;
  padding: 1rem;
  border-top: 1px solid var(--ds-border, #2d2d2d);
  background: var(--ds-surface, #1c1c1c);
}
.controls .cap { margin-bottom: 0.75rem; }
.control-row { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.6rem; }
.control-row:last-child { margin-bottom: 0; }
.control-label {
  font-size: 12px;
  color: var(--ds-text-secondary, #c8c8c8);
  min-width: 3rem;
}
.control-check {
  width: 15px; height: 15px;
  accent-color: var(--ds-render-green, #1a7a40);
  cursor: pointer;
}
.control-input,
.control-select {
  flex: 1;
  min-width: 0;
  padding: 5px 8px;
  font-size: 12px;
  color: var(--ds-text-primary, #f5f5f5);
  background: var(--ds-surface-dim, #0a0a0a);
  border: 1px solid var(--ds-border, #2d2d2d);
  border-radius: var(--ds-radius-sm, 6px);
}
.control-input:focus,
.control-select:focus {
  outline: none;
  border-color: #35b06a;
  box-shadow: 0 0 0 3px rgba(53, 176, 106, 0.25);
}
.control-btn {
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  color: #eafff2;
  background: var(--ds-render-green, #1a7a40);
  border: 0;
  border-radius: var(--ds-radius-sm, 6px);
  cursor: pointer;
  transition: box-shadow 0.15s ease, transform 0.1s ease;
}
.control-btn:hover { box-shadow: 0 2px 10px rgba(26, 122, 64, 0.5); }
.control-btn:active { transform: scale(0.97); }
.control-hint {
  margin-top: 0.5rem;
  font-size: 10.5px;
  line-height: 1.5;
  color: var(--ds-text-muted, #a0a0a0);
}
.list-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 4px;
  padding: 5px 10px;
  font-size: 12px;
  color: var(--ds-text-secondary, #c8c8c8);
  background: var(--ds-surface-dim, #0a0a0a);
  border: 1px solid var(--ds-border, #2d2d2d);
  border-radius: var(--ds-radius-sm, 6px);
}
.list-row__remove {
  padding: 0 4px;
  font-size: 13px;
  line-height: 1;
  color: var(--ds-text-muted, #a0a0a0);
  background: none;
  border: 0;
  cursor: pointer;
  transition: color 0.12s ease;
}
.list-row__remove:hover { color: #ef4444; }
```

Note: the secondary slot in a controls example is `display:flex; flex-direction:column` (from the split layout). Structure it as `.json-pane` (flex:1, scrolls) on top and `.controls` (flex-shrink:0) pinned below — matching the pre-existing structure, just restyled.

---

## Task A: Move `json-highlight` to shared

**Files:**
- Move: `cockpit/render/spec-rendering/angular/src/app/json-highlight.ts` → `cockpit/render/shared/json-highlight.ts`
- Move: `cockpit/render/spec-rendering/angular/src/app/json-highlight.spec.ts` → `cockpit/render/shared/json-highlight.spec.ts`
- Modify: `cockpit/render/spec-rendering/angular/src/app/spec-rendering.component.ts` (import path)

- [ ] **Step 1: git mv both files**

```bash
git mv cockpit/render/spec-rendering/angular/src/app/json-highlight.ts cockpit/render/shared/json-highlight.ts
git mv cockpit/render/spec-rendering/angular/src/app/json-highlight.spec.ts cockpit/render/shared/json-highlight.spec.ts
```

- [ ] **Step 2: Update spec-rendering's import**

In `cockpit/render/spec-rendering/angular/src/app/spec-rendering.component.ts`, change:
`import { highlightJson } from './json-highlight';`
to:
`import { highlightJson } from '../../../../shared/json-highlight';`

- [ ] **Step 3: Run the tests (new location)**

Run: `npx vitest run cockpit/render/shared/json-highlight.spec.ts`
Expected: PASS (8 tests).

- [ ] **Step 4: Rebuild spec-rendering to confirm the moved import resolves**

Run: `npx nx build cockpit-render-spec-rendering-angular --configuration=production`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(cockpit-render): move json-highlight tokenizer to render/shared for reuse"
```

---

## Task B: Redesign `registry` (no controls — validate the pattern)

**Files:**
- Modify: `cockpit/render/registry/angular/src/app/registry.component.ts`
- Modify: `cockpit/render/registry/angular/src/styles.css`

- [ ] **Step 1: Restyle the component**

Follow "Shared conventions". `registry` has NO controls panel — secondary is JSON-only, structurally identical to the exemplar. Registry set: Text, Heading, Badge, Card. Import `highlightJson` from `../../../../shared/json-highlight`. Replace all Tailwind classes with the exemplar's scoped styles (bar/tabs/status/cap/json-pane/json/json__foot + demo-component styles for Text/Heading/Badge/Card — copy the exemplar's `demo-badge`/`demo-card`/`demo-heading`/`demo-text` styles). Add `jsonTokens` computed + `#jsonScroll` autoscroll effect. Keep the class body logic (specs, activeIndex, selectSpec, store, registry) intact — only template + styles + the jsonTokens/import change.

- [ ] **Step 2: Update styles.css**

Replace `cockpit/render/registry/angular/src/styles.css` with the exemplar's styles.css content (the `@import "@threadplane/example-layouts/theme.css";`, `--ds-*` body, `.sr-skeleton` + `@keyframes sr-shimmer`).

- [ ] **Step 3: Exclude spec files from the app build (defensive; matches spec-rendering fix)**

If `cockpit/render/registry/angular/tsconfig.app.json` lacks an `exclude` for spec files, add `"exclude": ["src/**/*.spec.ts", "src/**/*.test.ts"]` after the `"include"` line. (Registry has no colocated specs today, but this keeps it consistent and safe.)

- [ ] **Step 4: Tailwind-free grep gate**

Run: `grep -nE 'class="[^"]*(px-|py-|text-\[|bg-\[|rounded-|gap-[0-9]|indigo|space-y-|tracking-w|shrink-|border-\[)' cockpit/render/registry/angular/src/app/registry.component.ts`
Expected: no output (exit 1).

- [ ] **Step 5: Production build**

Run: `npx nx build cockpit-render-registry-angular --configuration=production`
Expected: succeeds within budget.

- [ ] **Step 6: Commit**

```bash
git add cockpit/render/registry/angular/
git commit -m "feat(cockpit-render): redesign registry example with encapsulated CSS + syntax-colored JSON"
```

---

## Task C: Redesign `computed-functions` (no controls)

**Files:**
- Modify: `cockpit/render/computed-functions/angular/src/app/computed-functions.component.ts`
- Modify: `cockpit/render/computed-functions/angular/src/styles.css`

- [ ] **Step 1: Restyle the component**

Same as Task B. `computed-functions` has NO controls panel (JSON-only secondary). Registry set: Value, Heading, Card. Note the inline `demo-value` component renders a `label: value` row — style it as a mono `label / value` row on `--ds-*` (label muted, value `--ds-text-primary` mono). Reuse the exemplar's card/heading styles. Import `highlightJson` from `../../../../shared/json-highlight`. Add `jsonTokens` + autoscroll. Remove all Tailwind.

- [ ] **Step 2: styles.css** — replace with the exemplar's styles.css (as Task B Step 2).

- [ ] **Step 3: tsconfig spec-exclude** — as Task B Step 3, for `cockpit/render/computed-functions/angular/tsconfig.app.json`.

- [ ] **Step 4: grep gate** — as Task B Step 4, for `computed-functions.component.ts`.

- [ ] **Step 5: Production build**

Run: `npx nx build cockpit-render-computed-functions-angular --configuration=production`
Expected: succeeds.

- [ ] **Step 6: Commit**

```bash
git add cockpit/render/computed-functions/angular/
git commit -m "feat(cockpit-render): redesign computed-functions example with encapsulated CSS + syntax-colored JSON"
```

---

## Task D: Redesign `element-rendering` (+ checkbox control)

**Files:**
- Modify: `cockpit/render/element-rendering/angular/src/app/element-rendering.component.ts`
- Modify: `cockpit/render/element-rendering/angular/src/styles.css`

- [ ] **Step 1: Restyle the component + the controls panel**

Follow "Shared conventions" + add the Controls panel CSS. `element-rendering`'s secondary slot has the JSON console **and** a pinned-bottom "Controls" panel containing a **"Show Detail" checkbox** (bound to `/showDetail` in the state store) plus a hint caption. Structure secondary as `.json-pane` (flex:1) + `.controls` (flex-shrink:0) below. Style the checkbox row:

```html
<div class="controls">
  <div class="cap">Controls</div>
  <label class="control-row">
    <input type="checkbox" class="control-check" [checked]="showDetail()" (change)="onToggleDetail($event)" />
    <span class="control-label" style="min-width:auto">Show Detail</span>
  </label>
  <p class="control-hint">Toggles <code>/showDetail</code> in the state store. Elements with <code>visible</code> bindings react instantly.</p>
</div>
```

Keep the existing store↔signal bridge logic (the `store.subscribe` → `showDetail` signal and the toggle handler) intact — only restyle. Registry: Text, Heading, Card. Import `highlightJson` from shared, add `jsonTokens` + autoscroll. Remove all Tailwind (including the `bg-indigo-500` tab color → use `.tab--on` render-green).

- [ ] **Step 2: styles.css** — replace with the exemplar's styles.css.

- [ ] **Step 3: tsconfig spec-exclude** — for `cockpit/render/element-rendering/angular/tsconfig.app.json`.

- [ ] **Step 4: grep gate** — as Task B, for `element-rendering.component.ts`.

- [ ] **Step 5: Production build**

Run: `npx nx build cockpit-render-element-rendering-angular --configuration=production`
Expected: succeeds.

- [ ] **Step 6: Commit**

```bash
git add cockpit/render/element-rendering/angular/
git commit -m "feat(cockpit-render): redesign element-rendering example (encapsulated CSS, JSON console, styled Show-Detail control)"
```

---

## Task E: Redesign `state-management` (+ form controls)

**Files:**
- Modify: `cockpit/render/state-management/angular/src/app/state-management.component.ts`
- Modify: `cockpit/render/state-management/angular/src/styles.css`

- [ ] **Step 1: Restyle the component + the State Controls form**

Follow "Shared conventions" + Controls panel CSS. Secondary = `.json-pane` + a pinned `.controls` "State Controls" panel with three rows bound to the store: **Name** (`.control-input` type=text → `/user/name`), **Age** (`.control-input` type=number → `/user/age`), **Theme** (`.control-select` with Dark/Light → `/settings/theme`). Use `.control-row` with a `.control-label` per field:

```html
<div class="controls">
  <div class="cap">State Controls</div>
  <div class="control-row">
    <span class="control-label">Name</span>
    <input class="control-input" type="text" [value]="getState('/user/name')" (input)="setState('/user/name', $any($event.target).value)" />
  </div>
  <div class="control-row">
    <span class="control-label">Age</span>
    <input class="control-input" type="number" [value]="getState('/user/age')" (input)="setState('/user/age', +$any($event.target).value)" />
  </div>
  <div class="control-row">
    <span class="control-label">Theme</span>
    <select class="control-select" (change)="setState('/settings/theme', $any($event.target).value)">
      <option value="dark">Dark</option>
      <option value="light">Light</option>
    </select>
  </div>
</div>
```

Preserve the existing store read/write logic and method names (`getState`, and whatever setter the file uses — if it writes inline via `store.set(...)`, add a small `setState(path, value)` helper method or keep the inline expression the file already uses; do NOT invent new store APIs). Registry: Text, Heading, Label, Card — restyle `demo-label` as a mono `label: value` row. Import `highlightJson` from shared, add `jsonTokens` + autoscroll. Remove all Tailwind (indigo tab → render-green `.tab--on`).

- [ ] **Step 2: styles.css** — replace with the exemplar's styles.css.

- [ ] **Step 3: tsconfig spec-exclude** — for its `tsconfig.app.json`.

- [ ] **Step 4: grep gate** — for `state-management.component.ts`.

- [ ] **Step 5: Production build**

Run: `npx nx build cockpit-render-state-management-angular --configuration=production`
Expected: succeeds.

- [ ] **Step 6: Commit**

```bash
git add cockpit/render/state-management/angular/
git commit -m "feat(cockpit-render): redesign state-management example (encapsulated CSS, JSON console, styled state form)"
```

---

## Task F: Redesign `repeat-loops` (+ list-mutation controls)

**Files:**
- Modify: `cockpit/render/repeat-loops/angular/src/app/repeat-loops.component.ts`
- Modify: `cockpit/render/repeat-loops/angular/src/styles.css`

- [ ] **Step 1: Restyle the component + the List Controls**

Follow "Shared conventions" + Controls panel CSS. Secondary = `.json-pane` + pinned `.controls` "List Controls" panel with an **"+ Add Item"** `.control-btn` (full-width; `(click)="addItem()"`) and a list of current `/items` rows, each `.list-row` with the item text + a `.list-row__remove` "×" button (`(click)="removeItem($index)"`):

```html
<div class="controls">
  <div class="cap">List Controls</div>
  <button class="control-btn" type="button" style="width:100%" (click)="addItem()">+ Add Item</button>
  <div style="margin-top:0.6rem">
    @for (item of items(); track $index) {
      <div class="list-row"><span>{{ item }}</span><button class="list-row__remove" type="button" (click)="removeItem($index)">×</button></div>
    }
  </div>
  <p class="control-hint">Mutates the <code>/items</code> array in the state store; the rendered list reconciles by key.</p>
</div>
```

Preserve the existing `addItem`/`removeItem`/`counter` logic and the `items()` accessor (however the file currently reads the array from the store — keep that). Registry: Text, Heading, Card. Import `highlightJson` from shared, add `jsonTokens` + autoscroll. Remove all Tailwind (indigo → render-green).

- [ ] **Step 2: styles.css** — replace with the exemplar's styles.css.

- [ ] **Step 3: tsconfig spec-exclude** — for its `tsconfig.app.json`.

- [ ] **Step 4: grep gate** — for `repeat-loops.component.ts`.

- [ ] **Step 5: Production build**

Run: `npx nx build cockpit-render-repeat-loops-angular --configuration=production`
Expected: succeeds.

- [ ] **Step 6: Commit**

```bash
git add cockpit/render/repeat-loops/angular/
git commit -m "feat(cockpit-render): redesign repeat-loops example (encapsulated CSS, JSON console, styled list controls)"
```

---

## Task G: Integration gate — build all + repo-wide grep + tests

**Files:** none (verification only)

- [ ] **Step 1: Build all 5 (+ spec-rendering)**

Run: `npx nx run-many -t build --configuration=production -p cockpit-render-registry-angular cockpit-render-computed-functions-angular cockpit-render-element-rendering-angular cockpit-render-state-management-angular cockpit-render-repeat-loops-angular cockpit-render-spec-rendering-angular`
Expected: all succeed.

- [ ] **Step 2: Repo-wide Tailwind-free assertion across all render example components**

Run:
```bash
grep -REn 'class="[^"]*(px-[0-9]|py-[0-9]|text-\[|bg-\[|rounded-|gap-[0-9]|indigo|space-y-|tracking-w)' \
  cockpit/render/*/angular/src/app/*.component.ts
```
Expected: no output (exit 1).

- [ ] **Step 3: Highlighter tests (shared location)**

Run: `npx vitest run cockpit/render/shared/json-highlight.spec.ts`
Expected: PASS.

---

## Task H: Visual verification (orchestrator, Chrome MCP)

**Files:** none. Serve each example (`npx nx serve <proj> --port <angularPort>`; ports in `cockpit/ports.mjs`: registry 4404, computed-functions 4406, element-rendering 4402, state-management 4403, repeat-loops 4405) and verify with Chrome MCP:
- Styled tabs (render-green active), syntax-colored JSON console, status pulse, demo components render, skeleton→content.
- **Controls** render and function: element-rendering checkbox toggles detail; state-management form writes to the store (JSON updates); repeat-loops add/remove mutates the list.
- Light + dark theme both legible (spot-check one).
- Capture screenshots of the 3 controls examples for user sign-off before PR.

---

## Self-review

- **Coverage:** all 5 examples restyled (B–F); shared highlighter move (A); controls styling for the 3 that need it (D/E/F); registry + computed-functions no-controls (B/C); build+grep+test gate (G); Chrome verify incl. controls + themes (H).
- **Consistency:** tab active-state unified to render-green `.tab--on` across all (was indigo in 3, themed-primary in 2); JSON console + `highlightJson` now uniform; controls CSS shared across D/E/F.
- **No placeholders:** control markup + CSS are concrete; per-example logic preserved (no invented store APIs).
- **Risk:** each example's store-wiring logic differs slightly — tasks say preserve existing method names/accessors and only restyle. Subagents must read the file first and keep behavior.
