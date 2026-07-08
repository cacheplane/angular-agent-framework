# Cockpit Chat Token Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle affected bespoke cockpit example UI so it uses component-scoped CSS and the public `--tplane-chat-*` token API instead of compiled-away Tailwind utilities, inline theme styles, undefined legacy chat variables, or raw `--ds-*` tokens.

**Architecture:** Add a complete `--tplane-chat-*` bridge in `libs/example-layouts/src/theme.css`, backed by `--ds-*` design tokens where possible and existing chat token names where the library already has a public vocabulary. Then update only bespoke example app markup and component styles; leave `@threadplane/chat`, `@threadplane/ag-ui`, `@threadplane/render`, and example-layout chrome behavior intact.

**Tech Stack:** Angular standalone components, Nx, Vitest for `example-layouts`, encapsulated Angular `styles:`, `@threadplane/chat`, `@threadplane/example-layouts`, `@threadplane/render`, `@threadplane/langgraph`, `@threadplane/ag-ui`.

---

## Spec

Design spec: `docs/superpowers/specs/2026-07-08-cockpit-chat-token-redesign-design.md`

Spec review status: Approved.

## File Structure

Shared token bridge:

- Modify `libs/example-layouts/src/theme.css`: expand the `:root` `--tplane-chat-*` namespace bridge.
- Create `libs/example-layouts/src/lib/theme-bridge.spec.ts`: string-level regression test that `theme.css` exposes the public chat tokens needed by cockpit examples and maps core tokens to `--ds-*`.

Deep Agents examples:

- Modify `cockpit/deep-agents/skills/angular/src/app/skills.component.ts`
- Modify `cockpit/deep-agents/skills/angular/src/app/views/calculator-result.component.ts`
- Modify `cockpit/deep-agents/skills/angular/src/app/views/word-count-result.component.ts`
- Modify `cockpit/deep-agents/filesystem/angular/src/app/filesystem.component.ts`
- Modify `cockpit/deep-agents/filesystem/angular/src/app/views/file-preview.component.ts`
- Modify `cockpit/deep-agents/planning/angular/src/app/planning.component.ts`
- Modify `cockpit/deep-agents/planning/angular/src/app/views/checkbox-row.component.ts`
- Modify `cockpit/deep-agents/planning/angular/src/app/views/plan-checklist.component.ts`
- Modify `cockpit/deep-agents/sandboxes/angular/src/app/sandboxes.component.ts`
- Modify `cockpit/deep-agents/sandboxes/angular/src/app/views/code-execution.component.ts`
- Modify `cockpit/deep-agents/subagents/angular/src/app/subagents.component.ts`
- Modify `cockpit/deep-agents/memory/angular/src/app/memory.component.ts`
- Modify each changed Deep Agents app `tsconfig.app.json` only if a colocated spec is added under `src/`; no spec is expected for these apps.

Chat examples:

- Modify `cockpit/chat/input/angular/src/app/input.component.ts`
- Modify `cockpit/chat/messages/angular/src/app/messages.component.ts`
- Modify `cockpit/chat/theming/angular/src/app/theming.component.ts`
- Modify `cockpit/chat/threads/angular/src/app/threads.component.ts`
- Modify `cockpit/chat/interrupts/angular/src/app/interrupts.component.ts`
- Modify `cockpit/chat/timeline/angular/src/app/timeline.component.ts`
- Modify `cockpit/chat/tool-calls/angular/src/app/tool-calls.component.ts`
- Modify `cockpit/chat/subagents/angular/src/app/subagents.component.ts`
- Modify `cockpit/chat/generative-ui/angular/src/app/views/bar-chart.component.ts`
- Modify `cockpit/chat/generative-ui/angular/src/app/views/line-chart.component.ts`
- Modify `cockpit/chat/generative-ui/angular/src/app/views/stat-card.component.ts`
- Modify `cockpit/chat/generative-ui/angular/src/app/views/data-grid.component.ts`
- Modify `cockpit/chat/generative-ui/angular/src/app/views/skeleton.css` if skeleton colors need token remapping.
- Leave `cockpit/chat/a2ui/angular/src/app/a2ui.component.ts` and `cockpit/chat/debug/angular/src/app/debug.component.ts` alone unless a verification grep shows non-library bespoke styling that must change.

AG-UI examples:

- Modify `cockpit/ag-ui/interrupts/angular/src/app/interrupts.component.ts`
- Modify `cockpit/ag-ui/tool-views/angular/src/app/weather-card.component.ts`
- Modify `cockpit/ag-ui/client-tools/angular/src/app/weather-card.component.ts`
- Modify `cockpit/ag-ui/client-tools/angular/src/app/confirm-booking.component.ts`
- Modify `cockpit/ag-ui/json-render/angular/src/app/views/bar-chart.component.ts`
- Modify `cockpit/ag-ui/json-render/angular/src/app/views/line-chart.component.ts`
- Modify `cockpit/ag-ui/json-render/angular/src/app/views/stat-card.component.ts`
- Modify `cockpit/ag-ui/json-render/angular/src/app/views/data-grid.component.ts`
- Modify `cockpit/ag-ui/json-render/angular/src/app/views/skeleton.css` if skeleton colors need token remapping.
- Leave `cockpit/ag-ui/streaming`, `cockpit/ag-ui/subagents`, and `cockpit/ag-ui/a2ui` alone unless audit proves bespoke styling beyond library host classes.

Generated/context memory:

- Modify `/Users/blove/.claude/projects/-Users-blove-repos-angular-agent-framework/memory/project_cockpit_examples_tailwind_never_compiles.md` after implementation to update `STILL TODO`.

## Shared Rules For All Workers

- You are not alone in the codebase. Do not revert edits made by others. Work only in your assigned files.
- Preserve behavior exactly: handlers, signals, inputs, provider wiring, registry keys, selectors, welcome suggestions, and e2e-asserted strings.
- Do not touch library internals under `libs/chat`, `libs/ag-ui`, or `libs/render` except the shared example theme bridge and its test.
- Do not use Tailwind utility classes on bespoke elements.
- Do not use visual inline styles for theme styling. Allowed exception: structural dynamic custom properties such as `[style.--container-cols]`.
- Bespoke examples should consume `--tplane-chat-*`, not raw `--ds-*`.
- Keep `class="flex-1 min-w-0"` on `<chat>` host elements if present; it is a harmless library-host no-op exception.
- Use existing chat token names: `--tplane-chat-radius-card`, `--tplane-chat-radius-button`, `--tplane-chat-warning-bg`, `--tplane-chat-error-border`, etc.
- Use component-local variables only for narrow one-off derived values, and define them from `--tplane-chat-*`.

## Common CSS Kit

Use this vocabulary and adapt names only when local components already have a better established prefix:

```css
:host {
  --ex-read: #60a5fa;
  --ex-write: var(--tplane-chat-warning-text);
}

.panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--tplane-chat-bg);
  color: var(--tplane-chat-text);
}

.cap {
  margin: 0;
  font-size: var(--tplane-chat-font-size-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--tplane-chat-text-muted);
}

.empty {
  margin: 0;
  font-size: var(--tplane-chat-font-size-sm);
  font-style: italic;
  color: var(--tplane-chat-text-muted);
}

.card,
.row {
  border: 1px solid var(--tplane-chat-separator);
  border-radius: var(--tplane-chat-radius-card);
  background: var(--tplane-chat-surface-alt);
}

.badge {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  border-radius: var(--tplane-chat-radius-launcher);
  padding: 0.125rem 0.5rem;
  background: var(--tplane-chat-primary);
  color: var(--tplane-chat-on-primary);
  font-size: var(--tplane-chat-font-size-xs);
  font-weight: 700;
}

.code {
  margin: 0;
  padding: 0.5rem;
  overflow-x: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  border-radius: var(--tplane-chat-radius-card);
  background: var(--tplane-chat-surface);
  color: var(--tplane-chat-text);
  font: var(--tplane-chat-font-size-xs) / 1.5 var(--tplane-chat-font-mono);
}

.btn {
  border: 1px solid var(--tplane-chat-separator);
  border-radius: var(--tplane-chat-radius-button);
  background: var(--tplane-chat-surface-alt);
  color: var(--tplane-chat-text);
  cursor: pointer;
}

.btn:hover {
  background: color-mix(in srgb, var(--tplane-chat-text) 8%, var(--tplane-chat-surface-alt));
}

.btn:focus-visible {
  outline: 2px solid var(--tplane-chat-primary);
  outline-offset: 2px;
}
```

## Grep Gates

Use these commands after each task, narrowed to the files changed in that task.

No Tailwind utilities on bespoke files:

```bash
grep -REn 'class="[^"]*(px-[0-9]|py-[0-9]|p-[0-9]|rounded-|bg-(green|amber|red|blue|indigo|slate|gray|zinc|emerald|purple|sky|teal|orange)-|gap-[0-9]|w-[0-9]|h-[0-9]|border-\[|animate-|space-[xy]-|text-\[|tracking-|font-(semibold|medium|bold))' <changed-files>
```

Expected: no output, except `class="flex-1 min-w-0"` on library host components.

No direct design-token use in bespoke example components:

```bash
grep -REn -- '--ds-' <changed-example-component-files>
```

Expected: no output.

No undefined old chat variable names in changed files:

```bash
grep -REn -- '--tplane-chat-(surface-dim|primary-surface|primary-border|radius-sm|radius-md|radius-lg|radius-xl|radius-full|warning-surface|error-surface|success-surface)' <changed-files>
```

Expected: no output.

Visual inline style audit:

```bash
grep -REn 'style="|\[style\.' <changed-example-component-files>
```

Expected: no output for visual styling. Explicitly reviewed structural dynamic
bindings such as `[style.--container-cols]` are allowed, but `[style.background]`,
`[style.color]`, `[style.opacity]`, and similar theme styling bindings must be
converted to scoped CSS classes.

## Task 1: Theme Bridge

**Files:**
- Modify: `libs/example-layouts/src/theme.css`
- Create: `libs/example-layouts/src/lib/theme-bridge.spec.ts`

- [ ] **Step 1: Write failing bridge coverage**

Create `libs/example-layouts/src/lib/theme-bridge.spec.ts`:

```ts
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const themeCss = readFileSync(
  resolve(__dirname, '../theme.css'),
  'utf8',
);

describe('example-layouts theme chat token bridge', () => {
  it('maps public chat surface and text tokens to design tokens', () => {
    expect(themeCss).toContain('--tplane-chat-bg: var(--ds-canvas);');
    expect(themeCss).toContain('--tplane-chat-surface: var(--ds-surface);');
    expect(themeCss).toContain('--tplane-chat-surface-alt: var(--ds-surface-tinted);');
    expect(themeCss).toContain('--tplane-chat-text: var(--ds-text-primary);');
    expect(themeCss).toContain('--tplane-chat-text-muted: var(--ds-text-muted);');
    expect(themeCss).toContain('--tplane-chat-separator: var(--ds-border);');
  });

  it('defines the chat public control surface used by cockpit examples', () => {
    for (const token of [
      '--tplane-chat-input-bg',
      '--tplane-chat-primary',
      '--tplane-chat-accent',
      '--tplane-chat-on-primary',
      '--tplane-chat-font-mono',
      '--tplane-chat-font-size',
      '--tplane-chat-font-size-sm',
      '--tplane-chat-font-size-xs',
      '--tplane-chat-radius-card',
      '--tplane-chat-radius-button',
      '--tplane-chat-radius-bubble',
      '--tplane-chat-radius-input',
      '--tplane-chat-radius-launcher',
      '--tplane-chat-shadow-sm',
      '--tplane-chat-shadow-md',
      '--tplane-chat-shadow-lg',
      '--tplane-chat-success',
      '--tplane-chat-warning-bg',
      '--tplane-chat-warning-text',
      '--tplane-chat-error-bg',
      '--tplane-chat-error-border',
      '--tplane-chat-error-text',
      '--tplane-chat-destructive',
    ]) {
      expect(themeCss).toContain(`${token}:`);
    }
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npx nx test example-layouts --testFile=theme-bridge.spec.ts
```

Expected: FAIL because most of the listed `--tplane-chat-*` bridge tokens are not in `theme.css`.

- [ ] **Step 3: Expand the bridge**

In `libs/example-layouts/src/theme.css`, keep `@import "tailwindcss";` and `@custom-variant` unchanged. Replace the current small `:root` bridge body with a complete bridge using existing chat token names. The exact colors can be adjusted for contrast, but the names should match this shape:

```css
:root {
  --tplane-chat-bg: var(--ds-canvas);
  --tplane-chat-surface: var(--ds-surface);
  --tplane-chat-surface-alt: var(--ds-surface-tinted);
  --tplane-chat-input-bg: var(--ds-surface);
  --tplane-chat-text: var(--ds-text-primary);
  --tplane-chat-text-muted: var(--ds-text-muted);
  --tplane-chat-muted: var(--ds-text-muted);
  --tplane-chat-separator: var(--ds-border);

  --tplane-chat-primary: var(--ds-chat-purple);
  --tplane-chat-accent: var(--tplane-chat-primary);
  --tplane-chat-on-primary: var(--ds-text-inverted);
  --tplane-chat-destructive: #dc2626;

  --tplane-chat-error-bg: color-mix(in srgb, #ef4444 14%, transparent);
  --tplane-chat-error-border: #dc2626;
  --tplane-chat-error-text: #f87171;
  --tplane-chat-warning-bg: color-mix(in srgb, #f59e0b 14%, transparent);
  --tplane-chat-warning-text: #d97706;
  --tplane-chat-success: #22a05a;

  --tplane-chat-font-family: var(--ds-font-sans);
  --tplane-chat-font-mono: var(--ds-font-mono);
  --tplane-chat-font-size: 1rem;
  --tplane-chat-font-size-sm: 0.875rem;
  --tplane-chat-font-size-xs: 0.75rem;
  --tplane-chat-line-height: 1.5;
  --tplane-chat-line-height-tight: 1.25;

  --tplane-chat-radius-card: var(--ds-radius-md);
  --tplane-chat-radius-button: var(--ds-radius-sm);
  --tplane-chat-radius-bubble: var(--ds-radius-lg);
  --tplane-chat-radius-input: var(--ds-radius-lg);
  --tplane-chat-radius-launcher: var(--ds-radius-full);

  --tplane-chat-shadow-sm: var(--ds-shadow-sm);
  --tplane-chat-shadow-md: var(--ds-shadow-md);
  --tplane-chat-shadow-lg: var(--ds-shadow-lg);
}
```

- [ ] **Step 4: Run the bridge test**

Run:

```bash
npx nx test example-layouts --testFile=theme-bridge.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Build the theme package**

Run:

```bash
npx nx build example-layouts
```

Expected: PASS.

Main-agent commit after review:

```bash
git add libs/example-layouts/src/theme.css libs/example-layouts/src/lib/theme-bridge.spec.ts
git commit -m "feat(example-layouts): expose chat token bridge"
```

## Task 2: Deep Agents Bespoke UI

**Files:**
- Modify all Deep Agents files listed in the File Structure section.

- [ ] **Step 1: Audit e2e asserted text**

Run:

```bash
rg -n "Skill Invocations|No skills invoked yet|File Operations|No file operations yet|Plan|No plan yet|Execution Output|No code executed yet|Delegations|No delegations yet|Learned Facts|No facts learned yet" cockpit/deep-agents/*/angular/e2e
```

Expected: note any asserted strings and keep them byte-identical.

- [ ] **Step 2: Restyle sidebar shells**

For `skills`, `filesystem`, `planning`, `sandboxes`, `subagents`, and `memory` component templates:

- Change `sidebarWidth="w-72"` to `sidebarWidth="18rem"` and `sidebarWidth="w-80"` to `sidebarWidth="20rem"`.
- Replace `<div sidebar class="p-4 ...">` with `<aside sidebar class="panel">`.
- Replace Tailwind headings with `<h3 class="cap">...</h3>`.
- Replace empty paragraphs with `<p class="empty">...</p>`.
- Add component `styles: [...]` blocks based on the Common CSS Kit.

- [ ] **Step 3: Restyle Deep Agents rows and cards**

Use these per-example patterns:

- `skills.component.ts`: `.skill-card`, `.badge`, `.kv`, `.kv__label`, `.kv__label--success`, `.code`.
- `filesystem.component.ts`: `.file-op`, `.file-op__head`, `.op-badge`, `.op-badge--read`, `.op-badge--write`, `.file-path`, `.preview`.
- `planning.component.ts`: `.plan-row`, `.plan-icon`, `.plan-icon--complete`, `.plan-icon--active`, `.plan-title`; replace `animate-spin` with local `@keyframes spin`.
- `sandboxes.component.ts`: `.exec-card`, `.exec-label`, `.exec-label--success`, `.exec-label--error`, `.code`.
- `subagents.component.ts`: `.delegation`, `.dot`, `.dot--running`, `.dot--complete`, `.dot--error`, `.agent`, `.status`.
- `memory.component.ts`: `.fact-row`, `.fact-key`, `.fact-value`, `.count`.

- [ ] **Step 4: Restyle Deep Agents inline view components**

Convert these templates to plain classes plus `styles: [...]`:

- `calculator-result.component.ts`: pill card with `.result-pill`, `.result-badge`, `.result-expression`, `.result-value`.
- `word-count-result.component.ts`: same pattern, warning-colored badge using `--tplane-chat-warning-bg` and `--tplane-chat-warning-text`.
- `file-preview.component.ts`: `.file-card`, `.file-card__head`, `.file-card__path`, `.file-card__size`, `.file-card__body`.
- `checkbox-row.component.ts`: `.check-row`, `.check-row__box`, `.check-row__label`; preserve `(change)="toggle()"`.
- `plan-checklist.component.ts`: `.checklist`, `.checklist__title`.
- `code-execution.component.ts`: `.exec-view`, `.exec-view__head`, `.exec-view__body`, `.exec-view__section`, `.exec-view__label`, `.code`.

- [ ] **Step 5: Grep Deep Agents**

Run the Grep Gates over:

```bash
cockpit/deep-agents/skills/angular/src/app/skills.component.ts
cockpit/deep-agents/skills/angular/src/app/views/calculator-result.component.ts
cockpit/deep-agents/skills/angular/src/app/views/word-count-result.component.ts
cockpit/deep-agents/filesystem/angular/src/app/filesystem.component.ts
cockpit/deep-agents/filesystem/angular/src/app/views/file-preview.component.ts
cockpit/deep-agents/planning/angular/src/app/planning.component.ts
cockpit/deep-agents/planning/angular/src/app/views/checkbox-row.component.ts
cockpit/deep-agents/planning/angular/src/app/views/plan-checklist.component.ts
cockpit/deep-agents/sandboxes/angular/src/app/sandboxes.component.ts
cockpit/deep-agents/sandboxes/angular/src/app/views/code-execution.component.ts
cockpit/deep-agents/subagents/angular/src/app/subagents.component.ts
cockpit/deep-agents/memory/angular/src/app/memory.component.ts
```

Expected: no forbidden output.

- [ ] **Step 6: Build Deep Agents projects**

Run:

```bash
npx nx run-many -t build --configuration=production -p cockpit-deep-agents-skills-angular cockpit-deep-agents-filesystem-angular cockpit-deep-agents-planning-angular cockpit-deep-agents-sandboxes-angular cockpit-deep-agents-subagents-angular cockpit-deep-agents-memory-angular
```

Expected: PASS.

Main-agent commit after review:

```bash
git add cockpit/deep-agents
git commit -m "feat(cockpit-deep-agents): restyle bespoke UI with chat tokens"
```

## Task 3: Chat Sidebars And Primitive Shells

**Files:**
- Modify `cockpit/chat/input/angular/src/app/input.component.ts`
- Modify `cockpit/chat/messages/angular/src/app/messages.component.ts`
- Modify `cockpit/chat/theming/angular/src/app/theming.component.ts`
- Modify `cockpit/chat/threads/angular/src/app/threads.component.ts`
- Modify `cockpit/chat/interrupts/angular/src/app/interrupts.component.ts`
- Modify `cockpit/chat/timeline/angular/src/app/timeline.component.ts`
- Modify `cockpit/chat/tool-calls/angular/src/app/tool-calls.component.ts`
- Modify `cockpit/chat/subagents/angular/src/app/subagents.component.ts`

- [ ] **Step 1: Audit e2e asserted text**

Run:

```bash
rg -n "Chat Input Demo|Input State|Chat Messages Primitives|Theme Picker|CSS Variables|Threads|Interrupt Panel|Timeline|Tool Calls|Agent Pipeline|Book a flight|Plan a trip|Check a flight" cockpit/chat/*/angular/e2e
```

Expected: note asserted labels/descriptions and preserve them unless the theming token list must change to the supported public API.

- [ ] **Step 2: Restyle primitive main shells**

In `input.component.ts` and `messages.component.ts`:

- Replace `<div main class="flex-1 flex flex-col min-w-0">` with `<section main class="chat-demo">`.
- Replace header utility classes with `.demo-header` and `.demo-title`.
- Replace scroll wrapper utility classes with `.message-scroll`.
- Replace input footer utility classes with `.input-strip`.
- Add scoped CSS for these classes using `--tplane-chat-bg`, `--tplane-chat-surface`, `--tplane-chat-separator`, and `--tplane-chat-text`.

- [ ] **Step 3: Restyle static sidebars**

For all files in this task:

- Replace sidebar `div` utility classes with `<aside sidebar class="panel">`.
- Replace heading utility classes with `.cap`.
- Replace text blocks/lists with `.info`, `.info-list`, `.metric-list`, `.metric-label`, `.metric-value`.
- Use `--tplane-chat-font-mono` for status values and ids.
- Change `sidebarWidth="w-72"` to `sidebarWidth="18rem"`, `w-80` to `20rem`, and `w-64` to `16rem`.

- [ ] **Step 4: Restyle `chat/theming` as the public token API demo**

In `theming.component.ts`:

- Keep the theme preset behavior, but make presets set supported `--tplane-chat-*` variables such as `--tplane-chat-bg`, `--tplane-chat-text`, `--tplane-chat-primary`, `--tplane-chat-surface`, `--tplane-chat-surface-alt`, `--tplane-chat-separator`, and `--tplane-chat-text-muted`.
- Replace dynamic `[style.background]` and `[style.color]` on buttons with `[class.theme-button--active]="activeTheme() === name"`.
- Replace the visible CSS variable list with supported public tokens.
- Add `.theme-button`, `.theme-button--active`, `.token-list`, and `.token-list code`.

- [ ] **Step 5: Grep Chat sidebars/shells**

Run the Grep Gates over the eight changed files.

Expected: no forbidden output.

- [ ] **Step 6: Build Chat sidebar/shell projects**

Run:

```bash
npx nx run-many -t build --configuration=production -p cockpit-chat-input-angular cockpit-chat-messages-angular cockpit-chat-theming-angular cockpit-chat-threads-angular cockpit-chat-interrupts-angular cockpit-chat-timeline-angular cockpit-chat-tool-calls-angular cockpit-chat-subagents-angular
```

Expected: PASS.

Main-agent commit after review:

```bash
git add cockpit/chat/input cockpit/chat/messages cockpit/chat/theming cockpit/chat/threads cockpit/chat/interrupts cockpit/chat/timeline cockpit/chat/tool-calls cockpit/chat/subagents
git commit -m "feat(cockpit-chat): restyle sidebar and primitive demos with chat tokens"
```

## Task 4: Render View Cards In Chat And AG-UI

**Files:**
- Modify `cockpit/chat/generative-ui/angular/src/app/views/bar-chart.component.ts`
- Modify `cockpit/chat/generative-ui/angular/src/app/views/line-chart.component.ts`
- Modify `cockpit/chat/generative-ui/angular/src/app/views/stat-card.component.ts`
- Modify `cockpit/chat/generative-ui/angular/src/app/views/data-grid.component.ts`
- Modify `cockpit/chat/generative-ui/angular/src/app/views/skeleton.css` if needed.
- Modify `cockpit/ag-ui/json-render/angular/src/app/views/bar-chart.component.ts`
- Modify `cockpit/ag-ui/json-render/angular/src/app/views/line-chart.component.ts`
- Modify `cockpit/ag-ui/json-render/angular/src/app/views/stat-card.component.ts`
- Modify `cockpit/ag-ui/json-render/angular/src/app/views/data-grid.component.ts`
- Modify `cockpit/ag-ui/json-render/angular/src/app/views/skeleton.css` if needed.

- [ ] **Step 1: Preserve dynamic layout bindings**

Leave `container.component.ts` and `dashboard-grid.component.ts` alone unless verification proves theme styling is needed there. `[style.--container-cols]` is structural and allowed.

- [ ] **Step 2: Tokenize card surfaces**

In chart/stat/data card styles, replace hardcoded dark `rgba(255,255,255,...)` borders/background/text with:

- Border: `var(--tplane-chat-separator)`
- Background: `var(--tplane-chat-surface-alt)`
- Title/muted text: `var(--tplane-chat-text-muted)`
- Strong value/body text: `var(--tplane-chat-text)`
- Radius: `var(--tplane-chat-radius-card)`

- [ ] **Step 3: Tokenize SVG chart marks**

For SVG attributes:

- Grid/baseline strokes: `var(--tplane-chat-separator)`
- Axis/label fills: `var(--tplane-chat-text-muted)`
- Primary line/bar colors: `var(--tplane-chat-primary)`
- Point fill: `var(--tplane-chat-surface)`
- Positive delta: `var(--tplane-chat-success)`
- Negative delta: `var(--tplane-chat-error-text)`

Using CSS variables inside SVG attributes is acceptable. If a browser issue appears, move values into CSS classes and style SVG descendants through scoped CSS.

- [ ] **Step 4: Grep render cards**

Run the Grep Gates and also:

```bash
grep -REn 'rgba\(255|#[0-9a-fA-F]{3,6}' cockpit/chat/generative-ui/angular/src/app/views cockpit/ag-ui/json-render/angular/src/app/views
```

Expected: no hardcoded dark UI colors remain, except fixed semantic fallback colors if explicitly justified.

- [ ] **Step 5: Build render-card projects**

Run:

```bash
npx nx run-many -t build --configuration=production -p cockpit-chat-generative-ui-angular cockpit-ag-ui-json-render-angular
```

Expected: PASS.

Main-agent commit after review:

```bash
git add cockpit/chat/generative-ui cockpit/ag-ui/json-render
git commit -m "feat(cockpit): align render view cards with chat tokens"
```

## Task 5: AG-UI Bespoke Cards

**Files:**
- Modify `cockpit/ag-ui/interrupts/angular/src/app/interrupts.component.ts`
- Modify `cockpit/ag-ui/tool-views/angular/src/app/weather-card.component.ts`
- Modify `cockpit/ag-ui/client-tools/angular/src/app/weather-card.component.ts`
- Modify `cockpit/ag-ui/client-tools/angular/src/app/confirm-booking.component.ts`

- [ ] **Step 1: Audit e2e asserted text**

Run:

```bash
rg -n "Refund a duplicate charge|Refund a chargeback|Amount|Customer|Edit amount|Confirm|Cancel|Booking confirmed|Booking cancelled|Weather|Loading" cockpit/ag-ui/*/angular/e2e
```

Expected: preserve asserted suggestion labels and user-visible flow text.

- [ ] **Step 2: Restyle approval projected body**

In `interrupts.component.ts`:

- Replace projected `style="..."` content with `.approval-body`, `.approval-row`, `.approval-label`, `.approval-code`, `.approval-reason`, `.approval-edit`, `.approval-input`, and `.approval-save`.
- Preserve `editing`, `editAmount`, `onAction`, `submitEdit`, `resetEdit`, and all resume payload shapes.
- Style focus with `outline: 2px solid var(--tplane-chat-primary)`.

- [ ] **Step 3: Restyle weather cards**

In both weather card components:

- Keep existing `.wc` class names.
- Replace `--tplane-chat-separator` fallbacks and opacity-only styling with explicit public tokens.
- Add background, radius, text color, badge surface, and muted metadata styling.
- Preserve all `input()` declarations, including schema-derived AG-UI client tool props.

- [ ] **Step 4: Restyle confirm booking card**

In `confirm-booking.component.ts`:

- Keep `.cb` class names.
- Use `--tplane-chat-surface-alt`, `--tplane-chat-separator`, `--tplane-chat-text`, `--tplane-chat-text-muted`, `--tplane-chat-primary`, and `--tplane-chat-on-primary`.
- Preserve `injectRenderHost().result({ confirmed })`.

- [ ] **Step 5: Grep AG-UI cards**

Run the Grep Gates over the four changed files.

Expected: no forbidden output.

- [ ] **Step 6: Build AG-UI card projects**

Run:

```bash
npx nx run-many -t build --configuration=production -p cockpit-ag-ui-interrupts-angular cockpit-ag-ui-tool-views-angular cockpit-ag-ui-client-tools-angular
```

Expected: PASS.

Main-agent commit after review:

```bash
git add cockpit/ag-ui/interrupts cockpit/ag-ui/tool-views cockpit/ag-ui/client-tools
git commit -m "feat(cockpit-ag-ui): restyle bespoke cards with chat tokens"
```

## Task 6: Integration Verification And Memory Update

**Files:**
- Modify `/Users/blove/.claude/projects/-Users-blove-repos-angular-agent-framework/memory/project_cockpit_examples_tailwind_never_compiles.md`

- [ ] **Step 1: Run grouped production build**

Run:

```bash
npx nx run-many -t build --configuration=production -p example-layouts cockpit-deep-agents-skills-angular cockpit-deep-agents-filesystem-angular cockpit-deep-agents-planning-angular cockpit-deep-agents-sandboxes-angular cockpit-deep-agents-subagents-angular cockpit-deep-agents-memory-angular cockpit-chat-input-angular cockpit-chat-messages-angular cockpit-chat-theming-angular cockpit-chat-threads-angular cockpit-chat-interrupts-angular cockpit-chat-timeline-angular cockpit-chat-tool-calls-angular cockpit-chat-subagents-angular cockpit-chat-generative-ui-angular cockpit-ag-ui-interrupts-angular cockpit-ag-ui-tool-views-angular cockpit-ag-ui-client-tools-angular cockpit-ag-ui-json-render-angular
```

Expected: PASS. Pre-existing bundle budget or CJS warnings may appear; record them but do not treat unrelated warnings as failures.

- [ ] **Step 2: Run repo-wide changed-surface grep**

Run:

```bash
grep -REn 'class="[^"]*(px-[0-9]|py-[0-9]|p-[0-9]|rounded-|bg-(green|amber|red|blue|indigo|slate|gray|zinc|emerald|purple|sky|teal|orange)-|gap-[0-9]|w-[0-9]|h-[0-9]|border-\[|animate-|space-[xy]-|text-\[|tracking-|font-(semibold|medium|bold))' cockpit/deep-agents cockpit/chat cockpit/ag-ui
```

Expected: any remaining output must be library-host `class="flex-1 min-w-0"` or an intentionally untouched library-only example. Review and document exceptions.

- [ ] **Step 3: Confirm built CSS/token presence**

Run targeted bundle checks, for example:

```bash
grep -R -- '--tplane-chat-primary' dist/cockpit/deep-agents/skills/angular dist/cockpit/chat/theming/angular dist/cockpit/ag-ui/client-tools/angular | head
```

Expected: output showing compiled component styles contain public chat tokens.

- [ ] **Step 4: Update memory**

Edit `/Users/blove/.claude/projects/-Users-blove-repos-angular-agent-framework/memory/project_cockpit_examples_tailwind_never_compiles.md`:

- Mark this branch as addressing `deep-agents/*`, `chat/*`, and `ag-ui/*` bespoke UI.
- Note the new architectural decision: cockpit examples consume `--tplane-chat-*`; `theme.css` bridges to `--ds-*`.
- Leave any production visual verification notes if full live deploy verification is still pending.

- [ ] **Step 5: Final status**

Run:

```bash
git status --short
git log --oneline -5
```

Expected: only intentional changes remain. Summarize commits and verification evidence.

The memory file is outside the repository and cannot be committed from this
worktree. Update it as an external note and report that update in the final
summary; do not run `git add` on that path.

## Worker Dispatch Order

Use subagents after Task 1 lands. Task 1 touches shared theme state and should be completed first.

After Task 1:

- Worker A owns Task 2 (`cockpit/deep-agents/**` only).
- Worker B owns Task 3 (`cockpit/chat/input`, `messages`, `theming`, `threads`, `interrupts`, `timeline`, `tool-calls`, `subagents` only).
- Worker C owns Task 4 (`cockpit/chat/generative-ui/**` and `cockpit/ag-ui/json-render/**` only).
- Worker D owns Task 5 (`cockpit/ag-ui/interrupts`, `tool-views`, `client-tools` only).

Do not run two workers against the same files. The main agent reviews each worker result, runs the task-specific grep/build gates, and commits accepted work.
