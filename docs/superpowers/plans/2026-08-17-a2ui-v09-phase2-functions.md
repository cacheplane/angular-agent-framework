# A2UI v0.9 Phase 2 — Client-Side Functions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement A2UI v0.9 client-side function execution — `{call, args}` dynamic values resolve through a function registry (formatString/formatNumber/formatCurrency/formatDate/pluralize/and/or/not), and `action.functionCall` buttons execute locally (`openUrl`).

**Architecture:** A pure-TS function registry in `libs/a2ui` (`functions.ts`); `resolveDynamic` gains an optional registry parameter and invokes functions with recursively-resolved args; `surface-to-spec` passes a default registry and wires `functionCall` actions to the existing `a2ui:localAction` handler in `<a2ui-surface>`. Additive, non-breaking. Base: main after PR #817. Authoritative arg shapes: `scratchpad/basic-catalog.json` `functions` map (already verified).

**Tech Stack:** Pure TS + `Intl` (NumberFormat/PluralRules); vitest; no new deps.

---

### Task 1: `libs/a2ui/src/lib/functions.ts` — registry + standard functions

**Files:** Create `libs/a2ui/src/lib/functions.ts`, `functions.spec.ts`. Modify `libs/a2ui/src/index.ts`.

- [ ] Failing spec covering, per official schemas: `formatNumber` (decimals, grouping), `formatCurrency` (currency code, decimals), `formatDate` (TR35 subset: yy yyyy M MM MMM MMMM d dd E EEEE h hh H HH m mm s ss a; ISO-string and epoch input), `pluralize` (Intl.PluralRules categories, `other` fallback), `and`/`or` (values array, min 2)/`not`, `formatString` interpolation: `${/abs/path}`, `${relative}` (scope), nested calls with named args `${formatDate(value:${/d}, format:'yyyy-MM-dd')}`, quoted string args, `\${` escape, unknown function → `undefined` result for the whole value + one-time console.warn.
- [ ] Implement `A2uiFunctionContext { resolveArg(v: unknown): unknown; locale?: string }`, `A2uiFunctionImpl`, `A2uiFunctionRegistry = ReadonlyMap<string, A2uiFunctionImpl>`, `createA2uiFunctionRegistry(overrides?: Record<string, A2uiFunctionImpl>)`. formatString gets a small recursive expression parser (path | 'quoted' | number | ident(args)); keep it linear (no backtracking regexes — CodeQL).
- [ ] Export from `index.ts`. Green + commit.

### Task 2: `resolveDynamic` registry integration

**Files:** Modify `libs/a2ui/src/lib/resolve.ts`, `resolve.spec.ts`.

- [ ] Failing spec: `resolveDynamic({call:'formatCurrency',args:{value:{path:'/price'},currency:'USD'}}, {price: 42}, undefined, registry)` → formatted string; `{call}` without registry (or unknown name) → `undefined`; args containing `{path}`/nested `{call}` resolve against the model/scope.
- [ ] Implement optional 4th param `registry?: A2uiFunctionRegistry`; on `isFunctionCall`, look up impl and invoke with `ctx.resolveArg = (v) => resolveDynamic(v, model, scope, registry)`; missing impl → `undefined` (+ one-time warn per name). Green + commit.

### Task 3: renderer wiring

**Files:** Modify `libs/chat/src/lib/a2ui/surface-to-spec.ts`, `surface-to-spec.spec.ts`, `libs/chat/src/lib/a2ui/surface.component.ts` (openUrl noopener), specs.

- [ ] Failing spec: a Text `text: {call:'formatString', args:{value:'Total: ${/total}'}}` resolves in the spec props; `action: {functionCall:{call:'openUrl',args:{url}}}` produces `on.click = { action: 'a2ui:localAction', params: { call, args } }`; unknown-function props resolve to `undefined` (prop omitted-equivalent).
- [ ] Implement: module-level `DEFAULT_A2UI_FUNCTIONS = createA2uiFunctionRegistry()`; pass to every `resolveDynamic` call; delete the Phase-1 `isFunctionCall → skip` branches; `resolveAction` handles `functionCall`. In `surface.component.ts`, the existing `a2ui:localAction` openUrl builtin gains `'noopener'` window features. Green + commit.

### Task 4: prompts + docs

**Files:** Modify `examples/chat/python/src/schemas/a2ui_v09.py` + byte-identical ag-ui twin; `apps/website/content/docs/a2ui/reference/parser-resolver-guards.mdx`, `apps/website/content/docs/chat/a2ui/catalog.mdx` (functions section), `libs/a2ui/README.md`; `npm run generate-api-docs`.

- [ ] Schema prompt: functions section advertising the 8 value functions + `functionCall` actions with `openUrl`; examples use named-arg interpolation exactly per spec. Verify twins byte-identical; pytest suites still green.
- [ ] Docs updated from "typed, execution ships later" to shipped semantics. Commit.

### Task 5: verification + PR

- [ ] `npx nx run-many -t lint test build -p a2ui chat`; both example pytest suites; `npx nx affected -t lint test build`.
- [ ] Live Chrome smoke: serve examples/chat with real key, prompt for a surface using a formatted value (e.g. "show a card with today's date formatted"), verify function output renders.
- [ ] PR `feat(a2ui): client-side functions (Phase 2)`; merge on green.
