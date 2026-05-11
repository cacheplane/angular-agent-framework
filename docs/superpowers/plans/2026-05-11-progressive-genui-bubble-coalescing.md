# Progressive GenUI Rendering + Bubble Coalescing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the two-bubble GenUI flow (skeleton on M1, surface on M2) by (B) coalescing the backend's emit-phase AI message into the tool-call AI message in-place, AND (C) adding first-class per-component fallback rendering in `@ngaf/render` so each component swaps from skeleton to real in place as its bound props resolve.

**Architecture:** Three independent merge-ready PRs. PR A adds the fallback mechanism to `@ngaf/render` (registry entry shape + readiness gate in `<render-element>` + default fallback component). PR B drops the chat composition's bubble-level `<chat-genui-skeleton>` branch — `<a2ui-surface>` becomes the sole skeleton owner via the new per-component mechanism. PR C is a single-file Python change: `emit_generated_surface` returns an `AIMessage` with the upstream tool-call AI's id (LangGraph `add_messages` replaces in-place) AND reorders envelopes so `beginRendering` lands before `dataModelUpdate`s.

**Tech Stack:** Angular 21 standalone + signals + OnPush; Vitest (lib tests); pytest (Python); `@ngaf/render` + `@ngaf/chat` + LangGraph Python SDK.

**Spec:** `docs/superpowers/specs/2026-05-11-progressive-genui-bubble-coalescing-design.md` (commit `fd54045b` on `claude/spec-progressive-genui`).

**Hard constraint:** Never reference hashbrown / copilotkit / chatgpt / chatbot-kit / claude in code, comments, commits, PR bodies, or docs.

---

## File Structure

### PR A — `@ngaf/render` fallback (`claude/render-fallback-gate`)

**Create**
- `libs/render/src/lib/default-fallback.component.ts` — internal default fallback (shimmer card with "✨ Building UI…" label).
- `libs/render/src/lib/default-fallback.component.spec.ts` — 2 tests.

**Modify**
- `libs/render/src/lib/views.ts` — extend `ViewRegistry` type to accept the new entry shape; update `views()` factory to pass through.
- `libs/render/src/lib/render.types.ts` — add `RenderViewEntry` interface; extend `AngularRegistry` with `getFallback(name)`.
- `libs/render/src/lib/define-angular-registry.ts` — normalize entries; expose `getFallback`.
- `libs/render/src/lib/render-element.component.ts` — add `notReady` computed, fallback mount branch, monotonic `mountedReal` gate.
- `libs/render/src/lib/render-element.component.spec.ts` — extend with fallback tests.
- `libs/render/src/public-api.ts` — export `RenderViewEntry` type + `DefaultFallbackComponent`.

### PR B — Chat composition + catalog (`claude/chat-genui-bubble-cleanup`)

**Modify**
- `libs/chat/src/lib/compositions/chat/chat.component.ts` — drop the bubble-level `<chat-genui-skeleton>` branches in the AI message template.
- `libs/chat/src/lib/compositions/chat/chat.component.spec.ts` — remove the bubble-skeleton tests; add a negative test asserting no skeleton renders for GenUI turn.

### PR C — Python backend (`claude/genui-backend-coalescing`)

**Modify**
- `examples/chat/python/src/graph.py` — `emit_generated_surface` node returns `AIMessage(id=tool_call_ai.id, ...)`. Add envelope reorder pass: pull `beginRendering` to position 2 (right after `surfaceUpdate`).
- `examples/chat/python/tests/test_graph_smoke.py` — assert post-emit thread has 3 messages with the AI message id unchanged.

---

## Phase 0 — Branch creation (controller)

### Task 0.1: Fork PR A branch

- [ ] **Step 1: Fork**
```bash
git fetch origin && git checkout -b claude/render-fallback-gate origin/main
git log --oneline -1
```
Expected: latest origin/main HEAD.

---

## Phase 1 — `@ngaf/render` fallback (PR A)

### Task 1.1: Default fallback component

**Files:**
- Create: `libs/render/src/lib/default-fallback.component.ts`
- Create: `libs/render/src/lib/default-fallback.component.spec.ts`

- [ ] **Step 1: Write failing test**

```typescript
// libs/render/src/lib/default-fallback.component.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { DefaultFallbackComponent } from './default-fallback.component';

describe('DefaultFallbackComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [DefaultFallbackComponent] }));

  it('renders a region role with the Building UI status text', () => {
    const fx = TestBed.createComponent(DefaultFallbackComponent);
    fx.detectChanges();
    const status = fx.nativeElement.querySelector('[role="status"]');
    expect(status).toBeTruthy();
    expect(status.textContent).toContain('Building UI');
  });

  it('renders three shimmer rows', () => {
    const fx = TestBed.createComponent(DefaultFallbackComponent);
    fx.detectChanges();
    const rows = fx.nativeElement.querySelectorAll('.render-default-fallback__row');
    expect(rows.length).toBe(3);
  });
});
```

- [ ] **Step 2: Run, verify fail**
```bash
npx nx test render --testFile default-fallback.component.spec.ts 2>&1 | tail -10
```
Expected: FAIL — file not found.

- [ ] **Step 3: Implement**

```typescript
// libs/render/src/lib/default-fallback.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'render-default-fallback',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: block; width: 100%; }
    .render-default-fallback {
      border: 1px solid var(--ngaf-chat-separator, #303540);
      border-radius: 10px;
      padding: 14px;
      background: var(--ngaf-chat-surface-alt, #1a1d23);
    }
    .render-default-fallback__label {
      font-size: 12px;
      color: var(--ngaf-chat-text-muted, #9aa0aa);
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .render-default-fallback__rows {
      display: flex; flex-direction: column; gap: 8px;
    }
    .render-default-fallback__row {
      height: 10px; border-radius: 5px;
      background: linear-gradient(
        90deg,
        var(--ngaf-chat-separator, #303540) 0%,
        color-mix(in srgb, var(--ngaf-chat-separator, #303540) 70%, transparent) 50%,
        var(--ngaf-chat-separator, #303540) 100%
      );
      background-size: 200% 100%;
      animation: render-default-fallback-shimmer 1.4s ease-in-out infinite;
    }
    .render-default-fallback__row:nth-child(1) { width: 70%; }
    .render-default-fallback__row:nth-child(2) { width: 90%; }
    .render-default-fallback__row:nth-child(3) { width: 50%; }
    @keyframes render-default-fallback-shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `],
  template: `
    <div class="render-default-fallback" role="status" aria-live="polite">
      <div class="render-default-fallback__label">
        <span aria-hidden="true">✨</span>
        <span>Building UI…</span>
      </div>
      <div class="render-default-fallback__rows">
        <div class="render-default-fallback__row"></div>
        <div class="render-default-fallback__row"></div>
        <div class="render-default-fallback__row"></div>
      </div>
    </div>
  `,
})
export class DefaultFallbackComponent {}
```

- [ ] **Step 4: Run, verify pass**
```bash
npx nx test render --testFile default-fallback.component.spec.ts 2>&1 | tail -10
```
Expected: 2 passing.

- [ ] **Step 5: Commit**
```bash
git add libs/render/src/lib/default-fallback.component.ts \
        libs/render/src/lib/default-fallback.component.spec.ts
git commit -m "feat(render): DefaultFallbackComponent primitive

Card-shaped placeholder mounted when a registered component is
not yet ready to render (any state-bound prop unresolved). Used
as the fallback for registry entries that don't declare their
own, and as the top-level surface fallback for empty specs."
```

---

### Task 1.2: Extend `ViewRegistry` shape + `AngularRegistry` API

**Files:**
- Modify: `libs/render/src/lib/views.ts`
- Modify: `libs/render/src/lib/render.types.ts`
- Modify: `libs/render/src/lib/define-angular-registry.ts`

- [ ] **Step 1: Write failing test (new file)**

Create `libs/render/src/lib/define-angular-registry.spec.ts`:

```typescript
// libs/render/src/lib/define-angular-registry.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { Component } from '@angular/core';
import { defineAngularRegistry } from './define-angular-registry';
import { DefaultFallbackComponent } from './default-fallback.component';

@Component({ standalone: true, template: '<span>real</span>' })
class FakeRealComponent {}

@Component({ standalone: true, template: '<span>fallback</span>' })
class FakeFallbackComponent {}

describe('defineAngularRegistry — fallback API', () => {
  it('bare type entry: get returns the type; getFallback returns the default', () => {
    const reg = defineAngularRegistry({ button: FakeRealComponent });
    expect(reg.get('button')).toBe(FakeRealComponent);
    expect(reg.getFallback('button')).toBe(DefaultFallbackComponent);
  });

  it('object entry with fallback: get returns component; getFallback returns the configured fallback', () => {
    const reg = defineAngularRegistry({
      button: { component: FakeRealComponent, fallback: FakeFallbackComponent },
    });
    expect(reg.get('button')).toBe(FakeRealComponent);
    expect(reg.getFallback('button')).toBe(FakeFallbackComponent);
  });

  it('object entry without fallback: getFallback returns the default', () => {
    const reg = defineAngularRegistry({ button: { component: FakeRealComponent } });
    expect(reg.get('button')).toBe(FakeRealComponent);
    expect(reg.getFallback('button')).toBe(DefaultFallbackComponent);
  });

  it('unknown name: get returns undefined; getFallback returns undefined', () => {
    const reg = defineAngularRegistry({ button: FakeRealComponent });
    expect(reg.get('unknown')).toBeUndefined();
    expect(reg.getFallback('unknown')).toBeUndefined();
  });

  it('names() returns all registered keys regardless of entry shape', () => {
    const reg = defineAngularRegistry({
      button: FakeRealComponent,
      card: { component: FakeRealComponent, fallback: FakeFallbackComponent },
    });
    expect(reg.names().sort()).toEqual(['button', 'card']);
  });
});
```

- [ ] **Step 2: Run, verify fail**
```bash
npx nx test render --testFile define-angular-registry.spec.ts 2>&1 | tail -10
```
Expected: FAIL — `getFallback` not a function.

- [ ] **Step 3: Extend `render.types.ts`**

Replace `libs/render/src/lib/render.types.ts`:

```typescript
// SPDX-License-Identifier: MIT
import { Type } from '@angular/core';
import type { Spec, StateStore, ComputedFunction } from '@json-render/core';

export interface AngularComponentInputs {
  bindings?: Record<string, string>;
  emit: (event: string) => void;
  loading?: boolean;
  childKeys: string[];
  spec: Spec;
  [key: string]: unknown;
}

export type AngularComponentRenderer = Type<unknown>;

/**
 * A view registry entry. Bare `Type` form is the legacy shape; the
 * object form lets consumers attach a per-component fallback that
 * mounts while any state-bound prop on the element is still
 * unresolved. The fallback is monotonic per element instance: once
 * the real component mounts, subsequent re-renders never revert to
 * fallback even if a prop later resolves to undefined.
 */
export interface RenderViewEntry {
  component: Type<unknown>;
  fallback?: Type<unknown>;
}

export interface AngularRegistry {
  get(name: string): AngularComponentRenderer | undefined;
  /**
   * Returns the configured fallback for a registered name, OR the
   * lib's default fallback if the entry omits one, OR undefined if
   * the name is not registered.
   */
  getFallback(name: string): AngularComponentRenderer | undefined;
  names(): string[];
}

export interface RenderConfig {
  registry?: AngularRegistry;
  store?: StateStore;
  functions?: Record<string, ComputedFunction>;
  handlers?: Record<string, (params: Record<string, unknown>) => unknown | Promise<unknown>>;
  license?: string;
  __licenseEnvHint?: { isNoncommercial: boolean };
  __licensePublicKey?: Uint8Array;
}
```

- [ ] **Step 4: Update `views.ts`**

Replace:

```typescript
// SPDX-License-Identifier: MIT
import { Type } from '@angular/core';
import type { AngularRegistry, RenderViewEntry } from './render.types';
import { defineAngularRegistry } from './define-angular-registry';

/**
 * A registry of view components available for generative UI rendering.
 * Each entry is either a bare component Type (legacy shape) or a
 * `RenderViewEntry` { component, fallback? }.
 */
export type ViewRegistry = Readonly<Record<string, Type<unknown> | RenderViewEntry>>;

export function views(map: Record<string, Type<unknown> | RenderViewEntry>): ViewRegistry {
  return Object.freeze({ ...map });
}

export function withViews(
  base: ViewRegistry,
  additions: Record<string, Type<unknown> | RenderViewEntry>,
): ViewRegistry {
  return Object.freeze({ ...additions, ...base });
}

export function withoutViews(
  base: ViewRegistry,
  ...names: string[]
): ViewRegistry {
  const result = { ...base };
  for (const name of names) delete result[name];
  return Object.freeze(result);
}

export function toRenderRegistry(registry: ViewRegistry): AngularRegistry {
  return defineAngularRegistry(registry);
}
```

- [ ] **Step 5: Update `define-angular-registry.ts`**

Replace:

```typescript
// SPDX-License-Identifier: MIT
import { Type } from '@angular/core';
import type { AngularRegistry, RenderViewEntry } from './render.types';
import { DefaultFallbackComponent } from './default-fallback.component';

type RegistryInput = Record<string, Type<unknown> | RenderViewEntry>;

interface NormalizedEntry {
  component: Type<unknown>;
  fallback: Type<unknown>;
}

function normalize(entry: Type<unknown> | RenderViewEntry): NormalizedEntry {
  // Bare Type — register with the default fallback.
  if (typeof entry === 'function') {
    return { component: entry, fallback: DefaultFallbackComponent };
  }
  // Object form — preserve component; use configured fallback or default.
  return {
    component: entry.component,
    fallback: entry.fallback ?? DefaultFallbackComponent,
  };
}

export function defineAngularRegistry(componentMap: RegistryInput): AngularRegistry {
  const map = new Map<string, NormalizedEntry>();
  for (const [name, entry] of Object.entries(componentMap)) {
    map.set(name, normalize(entry));
  }
  return {
    get: (name: string) => map.get(name)?.component,
    getFallback: (name: string) => map.get(name)?.fallback,
    names: () => [...map.keys()],
  };
}
```

- [ ] **Step 6: Run tests**
```bash
npx nx test render --testFile define-angular-registry.spec.ts 2>&1 | tail -10
```
Expected: 5 passing.

- [ ] **Step 7: Verify build**
```bash
npx nx build render 2>&1 | tail -5
```
Expected: green.

- [ ] **Step 8: Commit**
```bash
git add libs/render/src/lib/views.ts \
        libs/render/src/lib/render.types.ts \
        libs/render/src/lib/define-angular-registry.ts \
        libs/render/src/lib/define-angular-registry.spec.ts
git commit -m "feat(render): ViewRegistry entry shape with optional fallback

Registry entries now accept either a bare Type (legacy) or a
{ component, fallback? } object. defineAngularRegistry normalizes
both shapes; bare entries get DefaultFallbackComponent. The
AngularRegistry interface gains getFallback(name) for downstream
consumers (render-element) to look up the fallback class."
```

---

### Task 1.3: `<render-element>` readiness gate + monotonic mount

**Files:**
- Modify: `libs/render/src/lib/render-element.component.ts`
- Modify: `libs/render/src/lib/render-element.component.spec.ts`

- [ ] **Step 1: Read current render-element to find the resolved-inputs computation**

```bash
grep -n "resolvedInputs\|componentClass\|NgComponentOutlet\|resolveElementProps" libs/render/src/lib/render-element.component.ts | head -15
```

Note: `resolvedInputs` is the computed signal at ~line 215 that builds the inputs map for `NgComponentOutlet`. We'll add a `notReady` computed and a `mountedReal` signal alongside it.

- [ ] **Step 2: Write failing tests (append to existing spec)**

Append to `libs/render/src/lib/render-element.component.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { Component, Input, signal } from '@angular/core';
import { RenderElementComponent } from './render-element.component';
import { defineAngularRegistry } from './define-angular-registry';
import { signalStateStore } from './signal-state-store';
import { RENDER_CONTEXT } from './contexts/render-context';
import type { Spec } from '@json-render/core';

@Component({ standalone: true, template: '<span data-test="real">label={{ label }}</span>' })
class FakeRealCmp {
  @Input() label?: string;
}

@Component({ standalone: true, template: '<span data-test="fallback">SKEL</span>' })
class FakeFallbackCmp {}

function specWithBinding(): Spec {
  return {
    root: 'btn1',
    elements: {
      btn1: { type: 'button', props: { label: { $state: '/label' } } },
    },
  };
}

@Component({
  standalone: true,
  imports: [RenderElementComponent],
  template: `<render-element [elementKey]="'btn1'" [spec]="spec" />`,
})
class FallbackHost {
  spec = specWithBinding();
}

describe('RenderElementComponent — fallback gate', () => {
  let store: ReturnType<typeof signalStateStore>;
  beforeEach(() => {
    store = signalStateStore({ });
    TestBed.configureTestingModule({
      imports: [FallbackHost],
      providers: [{
        provide: RENDER_CONTEXT,
        useValue: {
          store,
          registry: defineAngularRegistry({
            button: { component: FakeRealCmp, fallback: FakeFallbackCmp },
          }),
          functions: {},
          handlers: {},
        },
      }],
    });
  });

  it('renders the fallback when a state-bound prop resolves to undefined', () => {
    const fx = TestBed.createComponent(FallbackHost);
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('[data-test="fallback"]')).toBeTruthy();
    expect(fx.nativeElement.querySelector('[data-test="real"]')).toBeNull();
  });

  it('renders the real component once the state-bound prop is populated', () => {
    store.set('/label', 'click me');
    const fx = TestBed.createComponent(FallbackHost);
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('[data-test="real"]')).toBeTruthy();
    expect(fx.nativeElement.querySelector('[data-test="fallback"]')).toBeNull();
  });

  it('null counts as ready (not undefined)', () => {
    store.set('/label', null);
    const fx = TestBed.createComponent(FallbackHost);
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('[data-test="real"]')).toBeTruthy();
  });

  it('monotonic: once real mounts, a later undefined does not revert to fallback', () => {
    store.set('/label', 'click me');
    const fx = TestBed.createComponent(FallbackHost);
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('[data-test="real"]')).toBeTruthy();

    // Now CLEAR the binding — undefined again.
    store.set('/label', undefined);
    fx.detectChanges();
    // Still real, never reverts.
    expect(fx.nativeElement.querySelector('[data-test="real"]')).toBeTruthy();
    expect(fx.nativeElement.querySelector('[data-test="fallback"]')).toBeNull();
  });
});
```

- [ ] **Step 3: Run, verify fail**
```bash
npx nx test render --testFile render-element.component.spec.ts 2>&1 | tail -15
```
Expected: FAIL — fallback element not rendered.

- [ ] **Step 4: Implement the readiness gate**

Edit `libs/render/src/lib/render-element.component.ts`. Locate the `componentClass` computed (around line 133) and the template's `<ng-container *ngComponentOutlet="componentClass(); inputs: resolvedInputs(); ...">`. Make these three changes:

**(a) Add the `mountedReal` signal and `notReady` + `mountClass` computeds.** Add right below the existing `componentClass` computed:

```typescript
  /** Once real mounts, never revert to fallback even if a state-bound
   *  prop later becomes undefined. Per-instance monotonic gate. */
  private readonly mountedReal = signal<boolean>(false);

  /** True when ANY resolved prop value is undefined (i.e. a state
   *  binding points at a path the store hasn't populated). Framework-
   *  injected keys (bindings, emit, loading, childKeys, spec) are
   *  excluded — only consumer-resolved props matter for readiness. */
  readonly notReady = computed<boolean>(() => {
    if (this.mountedReal()) return false;
    const el = this.element();
    if (!el || !el.props) return false;
    const resolved = resolveElementProps(el.props, this.propCtx());
    for (const v of Object.values(resolved)) {
      if (v === undefined) return true;
    }
    return false;
  });

  /** Picks fallback or real based on notReady; flips mountedReal once. */
  readonly mountClass = computed<AngularComponentRenderer | null>(() => {
    const el = this.element();
    if (!el) return null;
    const real = this.ctx.registry.get(el.type) ?? null;
    if (this.notReady()) {
      return this.ctx.registry.getFallback(el.type) ?? null;
    }
    if (real && !this.mountedReal()) {
      // Latch — once we pick real, stay real for the rest of the lifecycle.
      queueMicrotask(() => this.mountedReal.set(true));
    }
    return real;
  });
```

Make sure `signal` is in the existing `@angular/core` import line — it is in the same file at the top.

**(b) Update the template** to use `mountClass()` instead of `componentClass()`:

Find:
```html
<ng-container
  *ngComponentOutlet="componentClass(); inputs: resolvedInputs(); injector: parentInjector"
/>
```
Replace with:
```html
<ng-container
  *ngComponentOutlet="mountClass(); inputs: resolvedInputs(); injector: parentInjector"
/>
```

Repeat for the `@for` block (repeat path):
```html
<ng-container
  *ngComponentOutlet="mountClass(); inputs: repeatInputs()[$index]; injector: repeatInjector"
/>
```

(Repeat-path fallback uses the SAME mountClass — repeat scope iterates over real state arrays, which only exist once the path is populated, so notReady is naturally false in this branch.)

**(c) Update the `visible` computed** to check `mountClass` instead of `componentClass` (so a missing fallback for a missing component still hides the element):

Find:
```typescript
readonly visible = computed(() => {
  const el = this.element();
  if (!el) return false;
  if (this.componentClass() === null) return false;
  return evaluateVisibility(el.visible, this.propCtx());
});
```
Replace `this.componentClass()` with `this.mountClass()`.

- [ ] **Step 5: Run tests**
```bash
npx nx test render --testFile render-element.component.spec.ts 2>&1 | tail -15
```
Expected: 4 new tests pass; pre-existing tests still pass.

- [ ] **Step 6: Verify build + lint**
```bash
npx nx build render 2>&1 | tail -5
npx nx lint render 2>&1 | tail -5
```
Both green expected.

- [ ] **Step 7: Commit**
```bash
git add libs/render/src/lib/render-element.component.ts \
        libs/render/src/lib/render-element.component.spec.ts
git commit -m "feat(render): render-element fallback gate + monotonic mount

Per-element readiness check: if any state-bound prop resolves
to undefined, mount the registry's fallback component instead
of the real one. Once real mounts, a latched mountedReal flag
prevents future reversion — subsequent re-renders only push
new input values via Angular's reactive system.

null counts as ready (it's a meaningful resolved value);
only undefined triggers fallback."
```

---

### Task 1.4: Public API exports + open PR A

**Files:**
- Modify: `libs/render/src/public-api.ts`

- [ ] **Step 1: Read existing public-api**
```bash
cat libs/render/src/public-api.ts
```

- [ ] **Step 2: Add exports**

Append to `libs/render/src/public-api.ts`:

```typescript
export { DefaultFallbackComponent } from './lib/default-fallback.component';
export type { RenderViewEntry } from './lib/render.types';
```

- [ ] **Step 3: Verify build + tests + lint**
```bash
npx nx build render 2>&1 | tail -5
npx nx test render 2>&1 | tail -10
npx nx lint render 2>&1 | tail -5
```
All green expected.

- [ ] **Step 4: Regenerate api-docs**
```bash
npm run generate-api-docs 2>&1 | tail -5
git status apps/website/content/docs/ --short
```
If changes appear, stage them.

- [ ] **Step 5: Commit + push + open PR**

```bash
git add libs/render/src/public-api.ts
git diff --cached --quiet || git commit -m "feat(render): export RenderViewEntry + DefaultFallbackComponent"

git add apps/website/content/docs/ 2>/dev/null
git diff --cached --quiet || git commit -m "chore: regenerate api-docs for render fallback API"

git push -u origin claude/render-fallback-gate

gh pr create --title "feat(render): per-component fallback API + readiness gate" --body "$(cat <<'EOF'
## Summary

Adds first-class per-component fallback rendering to \`@ngaf/render\`. Registry entries now accept an object shape:

\`\`\`typescript
const reg = views({
  button: { component: ButtonCmp, fallback: ButtonSkeletonCmp },
  card:   CardCmp,  // legacy bare shape still supported
});
\`\`\`

\`<render-element>\` mounts the fallback whenever any state-bound prop resolves to \`undefined\`. Once the real component mounts, a monotonic latch prevents future reversion to fallback — subsequent state changes flow through as reactive input updates.

\`DefaultFallbackComponent\` ships as the implicit fallback for entries that omit one.

This is the rendering primitive that unlocks progressive GenUI rendering in \`<a2ui-surface>\` — each A2UI component's data bindings resolve at their own pace, and each slot transitions skeleton → real in place as its bindings populate.

Spec: \`docs/superpowers/specs/2026-05-11-progressive-genui-bubble-coalescing-design.md\`.

## Test plan
- [x] \`nx test render\` green (registry tests, render-element fallback tests, default-fallback tests)
- [x] \`nx build render\` + \`nx lint render\` green
- [ ] CI green

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Capture the PR URL.

---

## Phase 2 — Chat composition (PR B)

### Task 2.0: Fork PR B branch

- [ ] **Step 1: Fork from origin/main (independent of PR A; can merge in either order)**
```bash
git checkout -b claude/chat-genui-bubble-cleanup origin/main
```

### Task 2.1: Drop the bubble-level skeleton branches

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat/chat.component.ts`

- [ ] **Step 1: Find the current skeleton branches**

```bash
grep -n "chat-genui-skeleton\|genuiTurn\|classified.type" libs/chat/src/lib/compositions/chat/chat.component.ts | head -10
```

Today's template (~line 167-178) has two `@if` branches that mount `<chat-genui-skeleton>`, plus an `@else if` mounting `<chat-streaming-md>`. We replace the conditional chain so the markdown branch stands alone:

- [ ] **Step 2: Edit the AI template**

Find:
```html
@if (genuiTurn && classified.type() !== 'a2ui' && classified.type() !== 'json-render') {
  <!-- GenUI turn awaiting the rendered surface — skeleton suppresses
       any streaming markdown that may flow before the classifier
       resolves (e.g. raw sub-LLM JSON envelopes streaming before
       emit_generated_surface prepends its A2UI sentinel prefix). -->
  <chat-genui-skeleton />
} @else if (classified.type() === 'a2ui' && classified.a2uiSurfaces().size === 0 && genuiTurn) {
  <!-- Surface event arrived but envelopes haven't yet parsed into surfaces. -->
  <chat-genui-skeleton />
} @else if (classified.markdown(); as md) {
  <chat-streaming-md [content]="md" [streaming]="agent().isLoading() && i === agent().messages().length - 1" />
}
```

Replace with:

```html
<!-- Streaming markdown (if classifier resolves to markdown for this turn).
     GenUI turns no longer show a bubble-level skeleton — the surface
     itself owns its empty-state placeholder (via @ngaf/render's per-
     component fallback in the registry). -->
@if (classified.markdown(); as md) {
  <chat-streaming-md [content]="md" [streaming]="agent().isLoading() && i === agent().messages().length - 1" />
}
```

The `genuiTurn` reference earlier in the template (still used for `[excludeToolNames]="genuiToolNames()"` on `<chat-tool-calls>`) stays — only the skeleton branches are removed.

Look at the surrounding lines to confirm the `<chat-streaming-md>` `@else if` collapses cleanly:

```bash
grep -n "classified.markdown\|chat-streaming-md\|chat-genui-skeleton" libs/chat/src/lib/compositions/chat/chat.component.ts | head -5
```

Expected after edit: one `@if` referencing `classified.markdown()`, no references to `chat-genui-skeleton` in the AI template.

The `ChatGenuiSkeletonComponent` import at the top of `chat.component.ts` becomes unused. **Leave the import in place** — `<chat-genui-skeleton>` remains a public-api export for direct-template consumers, and removing the import here changes nothing else. Actually verify it's still referenced elsewhere; if not, the lint rule for unused imports may flag it.

Look at the imports near the top:
```bash
grep -n "ChatGenuiSkeletonComponent" libs/chat/src/lib/compositions/chat/chat.component.ts
```

If the symbol is only in the import line and the component imports array, remove both to keep lint clean. The primitive is still exported via `public-api.ts` so external consumers are unaffected.

- [ ] **Step 3: Verify build + lint**
```bash
npx nx build chat 2>&1 | tail -5
npx nx lint chat 2>&1 | tail -5
```
Both green expected.

- [ ] **Step 4: Adjust tests**

If `chat.component.spec.ts` has explicit tests asserting `<chat-genui-skeleton>` renders inside the composition, those need to be removed or inverted. Read the file:

```bash
grep -n "chat-genui-skeleton" libs/chat/src/lib/compositions/chat/chat.component.spec.ts
```

If matches exist, replace them with negative assertions. Concretely, find tests asserting the skeleton appears for GenUI turns and rewrite them:

```typescript
it('does not render <chat-genui-skeleton> inside the AI template', () => {
  // … set up GenUI turn with tool_calls referencing 'generate_a2ui_schema' …
  fx.detectChanges();
  expect(fx.nativeElement.querySelector('chat-genui-skeleton')).toBeNull();
});
```

If there are no skeleton-positive tests, just add the negative one.

```bash
npx nx test chat --testFile chat.component.spec.ts 2>&1 | tail -10
```
Expected: green.

- [ ] **Step 5: Commit**
```bash
git add libs/chat/src/lib/compositions/chat/
git commit -m "feat(examples-chat,chat): drop bubble-level GenUI skeleton in composition

<a2ui-surface> now owns its skeleton state via @ngaf/render's
per-component fallback (see PR for render registry changes).
The chat composition no longer renders <chat-genui-skeleton>
inside the AI message template — the surface mounts with its
own progressive fallback as envelopes flow in.

<chat-genui-skeleton> stays exported as a public-api primitive
for direct-template consumers."
```

### Task 2.2: Regenerate api-docs + open PR B

- [ ] **Step 1: Regenerate**
```bash
npm run generate-api-docs 2>&1 | tail -5
git status apps/website/content/docs/ --short
```
If changes appear, stage them.

- [ ] **Step 2: Commit + push + open PR**
```bash
git add apps/website/content/docs/ 2>/dev/null
git diff --cached --quiet || git commit -m "chore: regenerate api-docs after chat composition cleanup"

git push -u origin claude/chat-genui-bubble-cleanup

gh pr create --title "feat(examples-chat,chat): drop bubble-level GenUI skeleton" --body "$(cat <<'EOF'
## Summary

Removes the two \`<chat-genui-skeleton>\` branches in the chat composition's AI template. The surface (\`<a2ui-surface>\`) now owns its skeleton state via @ngaf/render's per-component fallback mechanism — when the surface has zero components, the registry's default fallback mounts at the surface level; as components stream in, each component mounts its own fallback until its data bindings populate.

Pairs with the render fallback PR.

\`<chat-genui-skeleton>\` stays as a public-api primitive for direct-template consumers.

## Test plan
- [x] \`nx test chat --testFile chat.component.spec.ts\` green
- [x] \`nx build chat\` + \`nx lint chat\` green
- [ ] Live smoke after PR A merges
- [ ] CI green

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Capture the PR URL.

---

## Phase 3 — Python backend (PR C)

### Task 3.0: Fork PR C branch

- [ ] **Step 1: Fork from origin/main (independent of PR A and B)**
```bash
git checkout -b claude/genui-backend-coalescing origin/main
```

### Task 3.1: In-place AIMessage replacement + envelope reorder

**Files:**
- Modify: `examples/chat/python/src/graph.py`
- Modify: `examples/chat/python/tests/test_graph_smoke.py`

- [ ] **Step 1: Read current `emit_generated_surface`**

```bash
grep -n "def emit_generated_surface\|wrapped = A2UI_PREFIX\|return {" examples/chat/python/src/graph.py | head -10
```

Locate the function — it's near line 480-540.

- [ ] **Step 2: Write failing test**

Append to `examples/chat/python/tests/test_graph_smoke.py`:

```python
import pytest
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage
from src.graph import emit_generated_surface


class TestEmitGeneratedSurfaceCoalescing:
    def test_replaces_tool_call_ai_in_place_same_id(self):
        """emit_generated_surface returns an AIMessage with the same id
        as the upstream tool-call AI so add_messages replaces in-place."""
        tool_call_ai = AIMessage(
            id="ai-1",
            content=[
                {"type": "function_call", "name": "generate_a2ui_schema",
                 "arguments": '{"request":"r"}'}
            ],
            tool_calls=[{
                "id": "call_1",
                "name": "generate_a2ui_schema",
                "args": {"request": "r"},
                "type": "tool_call",
            }],
        )
        tool_msg = ToolMessage(
            tool_call_id="call_1",
            name="generate_a2ui_schema",
            content='[{"surfaceUpdate":{"surfaceId":"s1","components":[]}},'
                    '{"beginRendering":{"surfaceId":"s1","root":""}}]',
        )
        state = {
            "messages": [HumanMessage(content="render a card"), tool_call_ai, tool_msg],
            "gen_ui_mode": "a2ui",
        }

        result = emit_generated_surface(state)

        # Expect TWO message updates: the tool placeholder + a replacement
        # AIMessage with the SAME id as the upstream tool-call AI.
        msgs = result["messages"]
        assert len(msgs) == 2
        replacement_ai = next(m for m in msgs if isinstance(m, AIMessage))
        assert replacement_ai.id == "ai-1", \
            "Replacement AI must reuse the upstream tool-call AI id for in-place merge"
        # Content carries the wrapped surface payload.
        assert "---a2ui_JSON---" in replacement_ai.content
        # tool_calls is preserved so detection (frontend isGenuiTurn) still fires.
        assert any(tc.get("name") == "generate_a2ui_schema" for tc in replacement_ai.tool_calls)

    def test_beginRendering_envelope_ordering(self):
        """emit reorders the wrapped envelopes so beginRendering lands
        before any dataModelUpdate envelopes. This puts the surface in
        a visible state (per surface-store gating) as early as possible
        so per-component fallback can take over."""
        tool_call_ai = AIMessage(
            id="ai-2",
            content=[],
            tool_calls=[{
                "id": "call_2",
                "name": "generate_a2ui_schema",
                "args": {"request": "r"},
                "type": "tool_call",
            }],
        )
        tool_msg = ToolMessage(
            tool_call_id="call_2",
            name="generate_a2ui_schema",
            content='['
                    '{"surfaceUpdate":{"surfaceId":"s","components":[]}},'
                    '{"dataModelUpdate":{"surfaceId":"s","contents":[]}},'
                    '{"dataModelUpdate":{"surfaceId":"s","contents":[]}},'
                    '{"beginRendering":{"surfaceId":"s","root":""}}'
                    ']',
        )
        state = {"messages": [HumanMessage(content="x"), tool_call_ai, tool_msg],
                 "gen_ui_mode": "a2ui"}

        result = emit_generated_surface(state)
        replacement_ai = next(m for m in result["messages"] if isinstance(m, AIMessage))

        # Strip prefix + grab JSONL lines
        body = replacement_ai.content.split("---a2ui_JSON---\n", 1)[1].rstrip("\n")
        envelope_lines = body.split("\n")
        # First envelope = surfaceUpdate, SECOND = beginRendering, then dataModelUpdates.
        import json
        parsed = [json.loads(line) for line in envelope_lines]
        assert "surfaceUpdate" in parsed[0]
        assert "beginRendering" in parsed[1], \
            f"beginRendering should follow surfaceUpdate; got {list(parsed[1].keys())}"
        # The remaining dataModelUpdate envelopes follow.
        assert "dataModelUpdate" in parsed[2]
        assert "dataModelUpdate" in parsed[3]
```

- [ ] **Step 3: Run, verify fail**
```bash
cd examples/chat/python && source .venv/bin/activate && python -m pytest tests/test_graph_smoke.py::TestEmitGeneratedSurfaceCoalescing -v 2>&1 | tail -15
```
Expected: FAIL — `replacement_ai.id` is a new uuid, not `"ai-1"`.

- [ ] **Step 4: Implement the in-place replacement + reorder**

Edit `examples/chat/python/src/graph.py`. Locate `emit_generated_surface`. Around the existing logic that builds `wrapped` and returns `{"messages": [updated_tool_msg, new_ai]}`, make these changes:

**(a) Find the upstream tool-call AI:**

```python
async def emit_generated_surface(state: State) -> dict:
    # ... existing setup (read state messages, identify tool, payload, gen_ui_mode) ...
```

After the existing logic builds `wrapped` (the prefixed string for A2UI mode, or the stripped JSON for json-render mode), replace the final return block:

```python
    # Original (BEFORE):
    # new_ai = AIMessage(content=wrapped, id=str(uuid4()))
    # return {"messages": [updated_tool_msg, new_ai]}

    # In-place replacement: locate the upstream tool-call AIMessage and
    # return a replacement with the SAME id. LangGraph's add_messages
    # reducer matches by id and replaces, preserving tool_calls /
    # additional_kwargs / response_metadata on the wire-shape side
    # (we pass them through explicitly).
    tool_call_ai = next(
        m for m in reversed(state["messages"])
        if isinstance(m, AIMessage) and m.tool_calls
    )
    replacement = AIMessage(
        id=tool_call_ai.id,
        content=wrapped,
        tool_calls=tool_call_ai.tool_calls,
        additional_kwargs=tool_call_ai.additional_kwargs or {},
        response_metadata=tool_call_ai.response_metadata or {},
    )
    return {"messages": [updated_tool_msg, replacement]}
```

**(b) Add the envelope reorder before wrapping.** Find the line where `wrapped = A2UI_PREFIX + "\n" + jsonl + "\n"` is built. Just before that line, inject the reorder pass:

```python
    # Reorder envelopes so beginRendering lands in position 2 (right
    # after the first surfaceUpdate). The surface store gates surface
    # materialization on beginRendering; emitting it early lets the
    # frontend mount the (initially empty) surface and reveal per-
    # component fallbacks while dataModelUpdate envelopes flow.
    try:
        envelopes = json.loads(stripped) if isinstance(stripped, str) else stripped
        if isinstance(envelopes, list):
            surface_updates = [e for e in envelopes if "surfaceUpdate" in e]
            begin_renderings = [e for e in envelopes if "beginRendering" in e]
            data_updates = [e for e in envelopes if "dataModelUpdate" in e]
            others = [
                e for e in envelopes
                if not ("surfaceUpdate" in e or "beginRendering" in e or "dataModelUpdate" in e)
            ]
            # New order: all surfaceUpdates, then the FIRST beginRendering,
            # then dataModelUpdates, then any other envelopes, then any
            # remaining beginRenderings (rare; multi-surface).
            reordered = (
                surface_updates
                + (begin_renderings[:1] if begin_renderings else [])
                + data_updates
                + others
                + begin_renderings[1:]
            )
            jsonl = "\n".join(json.dumps(env) for env in reordered)
    except (json.JSONDecodeError, TypeError, AttributeError):
        # Bad input — fall back to whatever jsonl was built earlier.
        pass
```

The variable names (`stripped`, `jsonl`) need to match the existing function's locals. Read the function carefully and slot the reorder right before `wrapped = A2UI_PREFIX + "\n" + jsonl + "\n"`.

- [ ] **Step 5: Run pytest**
```bash
cd examples/chat/python && source .venv/bin/activate && python -m pytest tests/test_graph_smoke.py::TestEmitGeneratedSurfaceCoalescing -v 2>&1 | tail -15
```
Expected: 2 passing.

- [ ] **Step 6: Run full python suite**
```bash
cd examples/chat/python && source .venv/bin/activate && python -m pytest tests/ -v 2>&1 | tail -10
```
Expected: all existing tests still pass + 2 new tests pass.

- [ ] **Step 7: Commit + push + open PR**

```bash
git add examples/chat/python/src/graph.py examples/chat/python/tests/test_graph_smoke.py
git commit -m "feat(examples-chat): emit_generated_surface coalesces into tool-call AI

Two changes to the GenUI emit node:

1. In-place AIMessage replacement. The node returns an AIMessage with
   the SAME id as the upstream tool-call AI; LangGraph's add_messages
   reducer matches by id and replaces in place. The thread now carries
   one AI message per GenUI turn (with both tool_calls AND the wrapped
   surface content) instead of two — the user sees a single bubble that
   transforms from skeleton to surface, not a skeleton bubble followed
   by a separate surface bubble.

2. Envelope reorder. surfaceUpdate → beginRendering → dataModelUpdate
   × N. The surface store gates surface materialization on beginRendering;
   emitting it early lets the frontend mount the (initially empty) surface
   and reveal per-component fallbacks as dataModelUpdate envelopes flow
   in. Progressive UX without changing the protocol's semantic intent.

Preserved on the replacement AI: tool_calls (for frontend isGenuiTurn
detection + time-travel linkage), additional_kwargs (token counts,
reasoning, citations), response_metadata (model + finish-reason)."

git push -u origin claude/genui-backend-coalescing

gh pr create --title "feat(examples-chat): coalesce GenUI emit into tool-call AI + reorder envelopes" --body "$(cat <<'EOF'
## Summary

Two changes to \`emit_generated_surface\` in the Python graph:

1. **In-place AIMessage replacement.** Returns an AIMessage with the SAME id as the upstream tool-call AI. LangGraph's \`add_messages\` reducer matches by id and replaces — the thread carries ONE AI message per GenUI turn (with both \`tool_calls\` AND the wrapped surface content).

2. **Envelope reorder.** \`surfaceUpdate → beginRendering → dataModelUpdate × N\`. The surface store gates surface materialization on \`beginRendering\`; emitting it early lets the frontend mount the (initially empty) surface and reveal per-component fallbacks as data envelopes flow.

Pairs with the render fallback PR + the chat composition cleanup PR to deliver: one bubble per GenUI turn, surface mounts on the first envelope with per-component skeletons in the shape of the eventual UI, components swap from skeleton to real in place as their data bindings populate.

Spec: \`docs/superpowers/specs/2026-05-11-progressive-genui-bubble-coalescing-design.md\`.

## Test plan
- [x] \`pytest tests/test_graph_smoke.py::TestEmitGeneratedSurfaceCoalescing\` — 2 tests green
- [x] Full \`pytest tests/\` — all existing tests still pass
- [ ] Live smoke after PRs A + B + C all merge: GenUI prompt → single bubble, progressive skeleton → surface
- [ ] CI green

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Verification matrix

| Surface | Verifier |
|---|---|
| Registry shape + normalization | `define-angular-registry.spec.ts` (5 tests) |
| Default fallback rendering | `default-fallback.component.spec.ts` (2 tests) |
| Per-element readiness gate | `render-element.component.spec.ts` (4 fallback tests) |
| Monotonic mount | `render-element.component.spec.ts` (1 dedicated test) |
| Bubble-level skeleton absent | `chat.component.spec.ts` (1 negative test) |
| Backend in-place replacement | `tests/test_graph_smoke.py::TestEmitGeneratedSurfaceCoalescing::test_replaces_tool_call_ai_in_place_same_id` |
| Envelope reorder | `test_beginRendering_envelope_ordering` |
| End-to-end live | Chrome MCP smoke at `/embed` with a GenUI prompt; final DOM has one `<chat-message data-role="assistant">` per GenUI turn |

## Risk register

- **Render-element change affects ALL @ngaf/render consumers, not just A2UI.** The `notReady` gate fires whenever any state-bound prop is undefined. For non-A2UI consumers using static state stores (where bindings always resolve), the gate stays `false` and behavior is unchanged. Acceptable; tested.

- **Monotonic gate may "stick" if a re-render legitimately needs the fallback again.** E.g., a regenerate that clears all state and re-streams. *Mitigation*: a new render-element instance is created on element-key change (Angular tracks track-by id). The `mountedReal` signal lives on the instance, so a remount via `@for` track-id change gets a fresh latch. Verified by the regenerate live smoke.

- **Backend reorder breaks LLMs that emit envelopes interleaved on purpose.** If the sub-LLM intentionally interleaves `dataModelUpdate` between two `surfaceUpdate` envelopes (multi-surface update), our reorder collapses them. *Mitigation*: the single-surface case dominates today; multi-surface is rare. If it becomes important, the reorder can be scoped per-surfaceId.

- **null vs undefined distinction for ready.** The implementation specifies `null` counts as ready. Catalog components must handle `null` props gracefully (display dash, empty, etc.). Existing components mostly do; spot-check.

- **`<chat-genui-skeleton>` becomes unused inside the lib but stays exported.** Acceptable — it's a public primitive consumers may use directly. No removal.
