# @cacheplane/render Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Angular rendering layer for `@json-render/core` specs, providing the same capability as `@json-render/react` but using Angular standalone components, signals, and `ngTemplateOutlet` recursion.

**Architecture:** Peer dependency on `@json-render/core` for types, prop resolution, visibility evaluation, and streaming. The Angular layer provides: `RenderSpecComponent` (top-level entry), `RenderElementComponent` (recursive renderer), `signalStateStore()` (Signal-based StateStore), `defineAngularRegistry()` (component mapping), and `provideRender()` (DI configuration).

**Tech Stack:** Angular 21+, `@json-render/core`, Nx 22, ng-packagr, Vitest, TypeScript 5.9

**Spec:** `docs/superpowers/specs/2026-04-04-chat-component-library-design.md` — Deliverable 1

---

## File Structure

```
libs/render/
├── src/
│   ├── lib/
│   │   ├── render.types.ts                    # Angular-specific types (AngularComponentRenderer, AngularRegistry)
│   │   ├── define-angular-registry.ts          # defineAngularRegistry() factory
│   │   ├── define-angular-registry.spec.ts
│   │   ├── signal-state-store.ts               # signalStateStore() — Signal-backed StateStore
│   │   ├── signal-state-store.spec.ts
│   │   ├── provide-render.ts                   # provideRender() DI provider
│   │   ├── provide-render.spec.ts
│   │   ├── render-spec.component.ts            # <render-spec> top-level component
│   │   ├── render-spec.component.spec.ts
│   │   ├── render-element.component.ts         # <render-element> recursive renderer
│   │   ├── render-element.component.spec.ts
│   │   ├── contexts/
│   │   │   ├── repeat-scope.ts                 # RepeatScope injection token + context
│   │   │   └── render-context.ts               # RenderContext injection token (registry, store, functions)
│   │   └── internals/
│   │       ├── prop-signal.ts                  # Reactive prop resolution via computed signals
│   │       └── prop-signal.spec.ts
│   ├── public-api.ts
│   └── test-setup.ts
├── project.json
├── package.json
├── ng-package.json
├── tsconfig.json
├── tsconfig.lib.json
├── tsconfig.lib.prod.json
├── vite.config.mts
├── eslint.config.mjs
└── README.md
```

---

### Task 1: Scaffold the Nx Library

**Files:**
- Create: `libs/render/project.json`
- Create: `libs/render/package.json`
- Create: `libs/render/ng-package.json`
- Create: `libs/render/tsconfig.json`
- Create: `libs/render/tsconfig.lib.json`
- Create: `libs/render/tsconfig.lib.prod.json`
- Create: `libs/render/vite.config.mts`
- Create: `libs/render/eslint.config.mjs`
- Create: `libs/render/src/public-api.ts`
- Create: `libs/render/src/test-setup.ts`
- Modify: `tsconfig.base.json` (add path alias)

- [ ] **Step 1: Generate the library with Nx**

Run:
```bash
npx nx generate @nx/angular:library render --directory=libs/render --publishable --importPath=@cacheplane/render --prefix=render --standalone --skipModule --no-interactive
```

Expected: Nx scaffolds `libs/render/` with Angular library boilerplate.

- [ ] **Step 2: Update `libs/render/package.json` with peer deps and license**

Replace the generated package.json content:

```json
{
  "name": "@cacheplane/render",
  "version": "0.0.1",
  "peerDependencies": {
    "@angular/core": "^20.0.0 || ^21.0.0",
    "@angular/common": "^20.0.0 || ^21.0.0",
    "@json-render/core": "^0.1.0"
  },
  "license": "PolyForm-Noncommercial-1.0.0",
  "sideEffects": false
}
```

- [ ] **Step 3: Install `@json-render/core` as a devDependency in the root**

Run:
```bash
npm install --save-dev @json-render/core
```

Expected: Package added to root `package.json` devDependencies.

- [ ] **Step 4: Update `libs/render/project.json` to use Vitest**

Ensure the test target uses `@nx/vite:test`:

```json
{
  "name": "render",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/render/src",
  "projectType": "library",
  "prefix": "render",
  "targets": {
    "build": {
      "executor": "@nx/angular:package",
      "outputs": ["{workspaceRoot}/dist/{projectRoot}"],
      "options": {
        "project": "libs/render/ng-package.json",
        "tsConfig": "libs/render/tsconfig.lib.json"
      },
      "configurations": {
        "production": {
          "tsConfig": "libs/render/tsconfig.lib.prod.json"
        },
        "development": {}
      },
      "defaultConfiguration": "production"
    },
    "test": {
      "executor": "@nx/vite:test",
      "options": {
        "configFile": "libs/render/vite.config.mts"
      }
    },
    "lint": {
      "executor": "@nx/eslint:lint"
    },
    "nx-release-publish": {
      "options": {
        "packageRoot": "dist/{projectRoot}"
      }
    }
  },
  "release": {
    "version": {
      "generatorOptions": {
        "packageRoot": "libs/{projectName}",
        "currentVersionResolver": "git-tag",
        "fallbackCurrentVersionResolver": "disk"
      }
    }
  }
}
```

- [ ] **Step 5: Create `libs/render/vite.config.mts`**

```typescript
import { defineConfig } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export default defineConfig({
  plugins: [nxViteTsPaths()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
    setupFiles: ['src/test-setup.ts'],
  },
});
```

- [ ] **Step 6: Create `libs/render/src/test-setup.ts`**

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
```

- [ ] **Step 7: Create initial `libs/render/src/public-api.ts`**

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

// Public API — populated as components are built
```

- [ ] **Step 8: Verify path alias in `tsconfig.base.json`**

Ensure the paths section includes:
```json
"@cacheplane/render": ["libs/render/src/public-api.ts"]
```

- [ ] **Step 9: Verify the library builds**

Run:
```bash
npx nx build render
```

Expected: Build succeeds with empty library.

- [ ] **Step 10: Verify tests run**

Run:
```bash
npx nx test render
```

Expected: Test suite runs (0 tests, no failures).

- [ ] **Step 11: Commit**

```bash
git add libs/render/ tsconfig.base.json package.json package-lock.json
git commit -m "chore: scaffold @cacheplane/render library"
```

---

### Task 2: Types and Angular Registry

**Files:**
- Create: `libs/render/src/lib/render.types.ts`
- Create: `libs/render/src/lib/define-angular-registry.ts`
- Create: `libs/render/src/lib/define-angular-registry.spec.ts`
- Modify: `libs/render/src/public-api.ts`

- [ ] **Step 1: Write the failing test for defineAngularRegistry**

Create `libs/render/src/lib/define-angular-registry.spec.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { Component } from '@angular/core';
import { defineAngularRegistry } from './define-angular-registry';

@Component({ selector: 'test-card', standalone: true, template: '<div>card</div>' })
class TestCardComponent {}

@Component({ selector: 'test-button', standalone: true, template: '<button>btn</button>' })
class TestButtonComponent {}

describe('defineAngularRegistry', () => {
  it('should create a registry mapping component names to Angular components', () => {
    const registry = defineAngularRegistry({
      Card: TestCardComponent,
      Button: TestButtonComponent,
    });

    expect(registry.get('Card')).toBe(TestCardComponent);
    expect(registry.get('Button')).toBe(TestButtonComponent);
  });

  it('should return undefined for unregistered component names', () => {
    const registry = defineAngularRegistry({
      Card: TestCardComponent,
    });

    expect(registry.get('Unknown')).toBeUndefined();
  });

  it('should return all registered component names', () => {
    const registry = defineAngularRegistry({
      Card: TestCardComponent,
      Button: TestButtonComponent,
    });

    expect(registry.names()).toEqual(['Card', 'Button']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test render`

Expected: FAIL — `defineAngularRegistry` not found.

- [ ] **Step 3: Create types file**

Create `libs/render/src/lib/render.types.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Type } from '@angular/core';
import type { Spec, StateStore, UIElement, ComputedFunction } from '@json-render/core';

/**
 * Props passed to every Angular component rendered by the engine.
 * Mirrors @json-render/react's ComponentRenderProps.
 */
export interface AngularComponentInputs {
  /** Resolved props from the UIElement (dynamic expressions already evaluated) */
  props: Record<string, unknown>;
  /** Two-way binding paths: prop name → absolute state path */
  bindings?: Record<string, string>;
  /** Emit a named event (resolved to action bindings from the element's `on` field) */
  emit: (event: string) => void;
  /** Whether the spec is currently streaming/loading */
  loading?: boolean;
}

/**
 * An Angular standalone component class that can be rendered by the engine.
 */
export type AngularComponentRenderer = Type<unknown>;

/**
 * Registry mapping json-render catalog component names to Angular component classes.
 */
export interface AngularRegistry {
  /** Look up an Angular component by catalog name */
  get(name: string): AngularComponentRenderer | undefined;
  /** List all registered component names */
  names(): string[];
}

/**
 * Configuration for provideRender().
 */
export interface RenderConfig {
  /** Default registry for all <render-spec> instances */
  registry?: AngularRegistry;
  /** Default state store */
  store?: StateStore;
  /** Named functions for $computed expressions */
  functions?: Record<string, ComputedFunction>;
  /** Action handlers for event bindings */
  handlers?: Record<string, (params: Record<string, unknown>) => unknown | Promise<unknown>>;
}
```

- [ ] **Step 4: Implement defineAngularRegistry**

Create `libs/render/src/lib/define-angular-registry.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { AngularComponentRenderer, AngularRegistry } from './render.types';

/**
 * Create a registry mapping json-render catalog component names
 * to Angular standalone component classes.
 *
 * @example
 * ```typescript
 * const registry = defineAngularRegistry({
 *   Card: CardComponent,
 *   Button: ButtonComponent,
 * });
 * ```
 */
export function defineAngularRegistry(
  componentMap: Record<string, AngularComponentRenderer>,
): AngularRegistry {
  const map = new Map(Object.entries(componentMap));

  return {
    get: (name: string) => map.get(name),
    names: () => [...map.keys()],
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx nx test render`

Expected: 3 tests PASS.

- [ ] **Step 6: Export from public-api.ts**

Update `libs/render/src/public-api.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

// Types
export type {
  AngularComponentInputs,
  AngularComponentRenderer,
  AngularRegistry,
  RenderConfig,
} from './lib/render.types';

// Registry
export { defineAngularRegistry } from './lib/define-angular-registry';
```

- [ ] **Step 7: Commit**

```bash
git add libs/render/src/
git commit -m "feat(render): add types and defineAngularRegistry"
```

---

### Task 3: Signal State Store

**Files:**
- Create: `libs/render/src/lib/signal-state-store.ts`
- Create: `libs/render/src/lib/signal-state-store.spec.ts`
- Modify: `libs/render/src/public-api.ts`

- [ ] **Step 1: Write failing tests**

Create `libs/render/src/lib/signal-state-store.spec.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signalStateStore } from './signal-state-store';

describe('signalStateStore', () => {
  it('should implement StateStore interface with get/set', () => {
    TestBed.runInInjectionContext(() => {
      const store = signalStateStore({ name: 'test', count: 0 });

      expect(store.get('/name')).toBe('test');
      expect(store.get('/count')).toBe(0);

      store.set('/count', 5);
      expect(store.get('/count')).toBe(5);
    });
  });

  it('should return full state snapshot via getSnapshot', () => {
    TestBed.runInInjectionContext(() => {
      const store = signalStateStore({ a: 1, b: 2 });
      expect(store.getSnapshot()).toEqual({ a: 1, b: 2 });
    });
  });

  it('should batch updates via update()', () => {
    TestBed.runInInjectionContext(() => {
      const store = signalStateStore({ x: 0, y: 0 });
      store.update({ '/x': 10, '/y': 20 });
      expect(store.get('/x')).toBe(10);
      expect(store.get('/y')).toBe(20);
    });
  });

  it('should notify subscribers on state change', () => {
    TestBed.runInInjectionContext(() => {
      const store = signalStateStore({ val: 'a' });
      const listener = vi.fn();

      const unsub = store.subscribe(listener);
      store.set('/val', 'b');

      expect(listener).toHaveBeenCalled();
      unsub();
    });
  });

  it('should handle nested paths', () => {
    TestBed.runInInjectionContext(() => {
      const store = signalStateStore({ user: { name: 'Alice', age: 30 } });

      expect(store.get('/user/name')).toBe('Alice');
      store.set('/user/name', 'Bob');
      expect(store.get('/user/name')).toBe('Bob');
      expect(store.getSnapshot()).toEqual({ user: { name: 'Bob', age: 30 } });
    });
  });

  it('should handle array paths', () => {
    TestBed.runInInjectionContext(() => {
      const store = signalStateStore({ items: ['a', 'b', 'c'] });

      expect(store.get('/items/0')).toBe('a');
      store.set('/items/1', 'B');
      expect(store.get('/items/1')).toBe('B');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx test render`

Expected: FAIL — `signalStateStore` not found.

- [ ] **Step 3: Implement signalStateStore**

Create `libs/render/src/lib/signal-state-store.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { signal } from '@angular/core';
import type { StateStore, StateModel } from '@json-render/core';

/**
 * Parse a JSON Pointer path (RFC 6901) into segments.
 * "/user/name" → ["user", "name"]
 */
function parsePointer(path: string): string[] {
  if (!path || path === '/') return [];
  return path
    .split('/')
    .filter((_, i) => i > 0)
    .map(s => s.replace(/~1/g, '/').replace(/~0/g, '~'));
}

/**
 * Read a value from a nested object by path segments.
 */
function getByPath(obj: unknown, segments: string[]): unknown {
  let current: unknown = obj;
  for (const seg of segments) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
}

/**
 * Immutably set a value in a nested object by path segments.
 * Returns a new root object with the updated value.
 */
function setByPath(obj: Record<string, unknown>, segments: string[], value: unknown): Record<string, unknown> {
  if (segments.length === 0) return obj;

  const [head, ...rest] = segments;
  const current = obj[head];

  if (rest.length === 0) {
    return { ...obj, [head]: value };
  }

  const child = (current != null && typeof current === 'object')
    ? (Array.isArray(current) ? [...current] : { ...current as Record<string, unknown> })
    : {};

  return { ...obj, [head]: setByPath(child as Record<string, unknown>, rest, value) };
}

/**
 * Create an Angular Signal-backed StateStore compatible with @json-render/core.
 *
 * Uses JSON Pointer paths (RFC 6901) for all state access.
 * Immutable updates — every set/update creates a new state object.
 *
 * Must be called in an Angular injection context.
 */
export function signalStateStore(initialState: StateModel = {}): StateStore {
  const state = signal<StateModel>(initialState);
  const listeners = new Set<() => void>();

  function notify(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  return {
    get(path: string): unknown {
      const segments = parsePointer(path);
      return getByPath(state(), segments);
    },

    set(path: string, value: unknown): void {
      const segments = parsePointer(path);
      const current = getByPath(state(), segments);
      if (current === value) return;

      state.set(setByPath(state(), segments, value));
      notify();
    },

    update(updates: Record<string, unknown>): void {
      let current = state();
      let changed = false;

      for (const [path, value] of Object.entries(updates)) {
        const segments = parsePointer(path);
        const existing = getByPath(current, segments);
        if (existing !== value) {
          current = setByPath(current, segments, value);
          changed = true;
        }
      }

      if (changed) {
        state.set(current);
        notify();
      }
    },

    getSnapshot(): StateModel {
      return state();
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx test render`

Expected: All tests PASS.

- [ ] **Step 5: Add to public-api.ts**

Add to `libs/render/src/public-api.ts`:

```typescript
// State
export { signalStateStore } from './lib/signal-state-store';
```

- [ ] **Step 6: Commit**

```bash
git add libs/render/src/
git commit -m "feat(render): add signalStateStore backed by Angular signals"
```

---

### Task 4: DI Context Tokens

**Files:**
- Create: `libs/render/src/lib/contexts/render-context.ts`
- Create: `libs/render/src/lib/contexts/repeat-scope.ts`

- [ ] **Step 1: Create RenderContext injection token**

Create `libs/render/src/lib/contexts/render-context.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { InjectionToken } from '@angular/core';
import type { StateStore, ComputedFunction } from '@json-render/core';
import type { AngularRegistry } from '../render.types';

/**
 * Contextual data provided to all render-element instances via DI.
 * Set by RenderSpecComponent at the top level.
 */
export interface RenderContext {
  registry: AngularRegistry;
  store: StateStore;
  functions?: Record<string, ComputedFunction>;
  handlers?: Record<string, (params: Record<string, unknown>) => unknown | Promise<unknown>>;
  loading?: boolean;
}

export const RENDER_CONTEXT = new InjectionToken<RenderContext>('RENDER_CONTEXT');
```

- [ ] **Step 2: Create RepeatScope injection token**

Create `libs/render/src/lib/contexts/repeat-scope.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { InjectionToken } from '@angular/core';

/**
 * Repeat scope context provided when rendering inside a repeat element.
 * Each iteration gets its own RepeatScope via DI.
 */
export interface RepeatScope {
  /** The current array item */
  item: unknown;
  /** The current array index */
  index: number;
  /** Absolute state path to the current item (e.g. "/todos/0") */
  basePath: string;
}

export const REPEAT_SCOPE = new InjectionToken<RepeatScope>('REPEAT_SCOPE');
```

- [ ] **Step 3: Commit**

```bash
git add libs/render/src/lib/contexts/
git commit -m "feat(render): add DI tokens for RenderContext and RepeatScope"
```

---

### Task 5: Reactive Prop Resolution

**Files:**
- Create: `libs/render/src/lib/internals/prop-signal.ts`
- Create: `libs/render/src/lib/internals/prop-signal.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `libs/render/src/lib/internals/prop-signal.spec.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { computed } from '@angular/core';
import { createStateStore } from '@json-render/core';
import { buildPropResolutionContext } from './prop-signal';

describe('buildPropResolutionContext', () => {
  it('should build context from store snapshot', () => {
    TestBed.runInInjectionContext(() => {
      const store = createStateStore({ name: 'test' });
      const ctx = buildPropResolutionContext(store);

      expect(ctx.stateModel).toEqual({ name: 'test' });
    });
  });

  it('should include repeat scope when provided', () => {
    TestBed.runInInjectionContext(() => {
      const store = createStateStore({ items: ['a', 'b'] });
      const repeatScope = { item: 'a', index: 0, basePath: '/items/0' };
      const ctx = buildPropResolutionContext(store, repeatScope);

      expect(ctx.repeatItem).toBe('a');
      expect(ctx.repeatIndex).toBe(0);
      expect(ctx.repeatBasePath).toBe('/items/0');
    });
  });

  it('should include functions when provided', () => {
    TestBed.runInInjectionContext(() => {
      const store = createStateStore({});
      const fns = { upper: (args: Record<string, unknown>) => String(args['text']).toUpperCase() };
      const ctx = buildPropResolutionContext(store, undefined, fns);

      expect(ctx.functions).toBe(fns);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx test render`

Expected: FAIL — `buildPropResolutionContext` not found.

- [ ] **Step 3: Implement buildPropResolutionContext**

Create `libs/render/src/lib/internals/prop-signal.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { StateStore, ComputedFunction } from '@json-render/core';
import type { PropResolutionContext } from '@json-render/core';
import type { RepeatScope } from '../contexts/repeat-scope';

/**
 * Build a PropResolutionContext from the current store state and optional repeat scope.
 * This context is passed to resolveElementProps() and resolveBindings().
 */
export function buildPropResolutionContext(
  store: StateStore,
  repeatScope?: RepeatScope,
  functions?: Record<string, ComputedFunction>,
): PropResolutionContext {
  const ctx: PropResolutionContext = {
    stateModel: store.getSnapshot(),
  };

  if (repeatScope) {
    ctx.repeatItem = repeatScope.item;
    ctx.repeatIndex = repeatScope.index;
    ctx.repeatBasePath = repeatScope.basePath;
  }

  if (functions) {
    ctx.functions = functions;
  }

  return ctx;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx test render`

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/render/src/lib/internals/
git commit -m "feat(render): add prop resolution context builder"
```

---

### Task 6: provideRender DI Provider

**Files:**
- Create: `libs/render/src/lib/provide-render.ts`
- Create: `libs/render/src/lib/provide-render.spec.ts`
- Modify: `libs/render/src/public-api.ts`

- [ ] **Step 1: Write failing tests**

Create `libs/render/src/lib/provide-render.spec.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideRender, RENDER_CONFIG } from './provide-render';
import { defineAngularRegistry } from './define-angular-registry';
import type { RenderConfig } from './render.types';

@Component({ selector: 'test-card', standalone: true, template: '<div>card</div>' })
class TestCardComponent {}

describe('provideRender', () => {
  it('should provide RenderConfig via injection token', () => {
    const registry = defineAngularRegistry({ Card: TestCardComponent });
    const config: RenderConfig = { registry };

    TestBed.configureTestingModule({
      providers: [provideRender(config)],
    });

    const injectedConfig = TestBed.inject(RENDER_CONFIG);
    expect(injectedConfig.registry).toBe(registry);
  });

  it('should allow injection without provider (returns undefined)', () => {
    TestBed.configureTestingModule({});

    const injectedConfig = TestBed.inject(RENDER_CONFIG, null);
    expect(injectedConfig).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx test render`

Expected: FAIL — `provideRender` not found.

- [ ] **Step 3: Implement provideRender**

Create `libs/render/src/lib/provide-render.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { InjectionToken, makeEnvironmentProviders } from '@angular/core';
import type { RenderConfig } from './render.types';

/**
 * Injection token for global render configuration.
 * Optional — components also accept inputs directly.
 */
export const RENDER_CONFIG = new InjectionToken<RenderConfig>('RENDER_CONFIG');

/**
 * Provide default render configuration for all <render-spec> instances.
 *
 * @example
 * ```typescript
 * bootstrapApplication(AppComponent, {
 *   providers: [
 *     provideRender({
 *       registry: defineAngularRegistry({ Card: CardComponent }),
 *     }),
 *   ],
 * });
 * ```
 */
export function provideRender(config: RenderConfig) {
  return makeEnvironmentProviders([
    { provide: RENDER_CONFIG, useValue: config },
  ]);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx test render`

Expected: All tests PASS.

- [ ] **Step 5: Add to public-api.ts**

Add to `libs/render/src/public-api.ts`:

```typescript
// Provider
export { provideRender, RENDER_CONFIG } from './lib/provide-render';
```

- [ ] **Step 6: Commit**

```bash
git add libs/render/src/
git commit -m "feat(render): add provideRender DI provider"
```

---

### Task 7: RenderElementComponent (Recursive Renderer)

**Files:**
- Create: `libs/render/src/lib/render-element.component.ts`
- Create: `libs/render/src/lib/render-element.component.spec.ts`
- Modify: `libs/render/src/public-api.ts`

- [ ] **Step 1: Write failing tests**

Create `libs/render/src/lib/render-element.component.spec.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component, input } from '@angular/core';
import { createStateStore } from '@json-render/core';
import type { Spec } from '@json-render/core';
import { RenderElementComponent } from './render-element.component';
import { RENDER_CONTEXT, type RenderContext } from './contexts/render-context';
import { defineAngularRegistry } from './define-angular-registry';

@Component({
  selector: 'test-text',
  standalone: true,
  template: '<span>{{ props().label }}</span>',
})
class TestTextComponent {
  props = input.required<Record<string, unknown>>();
}

@Component({
  selector: 'test-container',
  standalone: true,
  template: '<div class="container"><ng-content /></div>',
})
class TestContainerComponent {
  props = input.required<Record<string, unknown>>();
}

function createContext(overrides?: Partial<RenderContext>): RenderContext {
  return {
    registry: defineAngularRegistry({ Text: TestTextComponent, Container: TestContainerComponent }),
    store: createStateStore({}),
    ...overrides,
  };
}

describe('RenderElementComponent', () => {
  it('should render a simple element', async () => {
    const spec: Spec = {
      root: 'heading',
      elements: {
        heading: { type: 'Text', props: { label: 'Hello' } },
      },
    };

    TestBed.configureTestingModule({
      imports: [RenderElementComponent],
      providers: [{ provide: RENDER_CONTEXT, useValue: createContext() }],
    });

    const fixture = TestBed.createComponent(RenderElementComponent);
    fixture.componentRef.setInput('elementKey', 'heading');
    fixture.componentRef.setInput('spec', spec);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Hello');
  });

  it('should not render when element type is not in registry', async () => {
    const spec: Spec = {
      root: 'unknown',
      elements: {
        unknown: { type: 'NonExistent', props: {} },
      },
    };

    TestBed.configureTestingModule({
      imports: [RenderElementComponent],
      providers: [{ provide: RENDER_CONTEXT, useValue: createContext() }],
    });

    const fixture = TestBed.createComponent(RenderElementComponent);
    fixture.componentRef.setInput('elementKey', 'unknown');
    fixture.componentRef.setInput('spec', spec);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent.trim()).toBe('');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx test render`

Expected: FAIL — `RenderElementComponent` not found.

- [ ] **Step 3: Implement RenderElementComponent**

Create `libs/render/src/lib/render-element.component.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  computed,
  inject,
  input,
  ChangeDetectionStrategy,
  Injector,
  EnvironmentInjector,
} from '@angular/core';
import { NgComponentOutlet, NgTemplateOutlet } from '@angular/common';
import { resolveElementProps, resolveBindings, evaluateVisibility } from '@json-render/core';
import type { Spec, UIElement } from '@json-render/core';
import { RENDER_CONTEXT } from './contexts/render-context';
import { REPEAT_SCOPE, type RepeatScope } from './contexts/repeat-scope';
import { buildPropResolutionContext } from './internals/prop-signal';

@Component({
  selector: 'render-element',
  standalone: true,
  imports: [NgComponentOutlet, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isVisible()) {
      @if (componentClass()) {
        @if (repeat()) {
          @for (item of repeatItems(); track $index) {
            <ng-container
              *ngComponentOutlet="componentClass()!; inputs: resolvedInputsForRepeatItem(item, $index); injector: repeatInjector(item, $index)"
            >
            </ng-container>
          }
        } @else {
          <ng-container
            *ngComponentOutlet="componentClass()!; inputs: resolvedInputs()"
          >
          </ng-container>
        }
      }
    }
  `,
})
export class RenderElementComponent {
  readonly elementKey = input.required<string>();
  readonly spec = input.required<Spec>();

  private readonly ctx = inject(RENDER_CONTEXT);
  private readonly repeatScope = inject(REPEAT_SCOPE, { optional: true });
  private readonly injector = inject(Injector);
  private readonly envInjector = inject(EnvironmentInjector);

  protected readonly element = computed<UIElement | undefined>(() => {
    return this.spec().elements[this.elementKey()];
  });

  protected readonly componentClass = computed(() => {
    const el = this.element();
    if (!el) return undefined;
    return this.ctx.registry.get(el.type);
  });

  protected readonly repeat = computed(() => {
    return this.element()?.repeat;
  });

  protected readonly repeatItems = computed<unknown[]>(() => {
    const rep = this.repeat();
    if (!rep) return [];
    const items = this.ctx.store.get(rep.statePath);
    return Array.isArray(items) ? items : [];
  });

  protected readonly isVisible = computed(() => {
    const el = this.element();
    if (!el || el.visible === undefined) return true;
    return evaluateVisibility(el.visible, {
      stateModel: this.ctx.store.getSnapshot(),
      repeatItem: this.repeatScope?.item,
      repeatIndex: this.repeatScope?.index,
    });
  });

  protected readonly resolvedInputs = computed(() => {
    const el = this.element();
    if (!el) return {};
    const propCtx = buildPropResolutionContext(
      this.ctx.store,
      this.repeatScope ?? undefined,
      this.ctx.functions,
    );
    const resolvedProps = resolveElementProps(el.props, propCtx);
    const bindings = resolveBindings(el.props, propCtx);

    return {
      props: resolvedProps,
      bindings: bindings ?? undefined,
      emit: this.createEmitFn(el),
      loading: this.ctx.loading ?? false,
    };
  });

  protected resolvedInputsForRepeatItem(item: unknown, index: number) {
    const el = this.element();
    if (!el) return {};
    const rep = this.repeat()!;
    const scope: RepeatScope = {
      item,
      index,
      basePath: `${rep.statePath}/${index}`,
    };
    const propCtx = buildPropResolutionContext(this.ctx.store, scope, this.ctx.functions);
    const resolvedProps = resolveElementProps(el.props, propCtx);
    const bindings = resolveBindings(el.props, propCtx);

    return {
      props: resolvedProps,
      bindings: bindings ?? undefined,
      emit: this.createEmitFn(el),
      loading: this.ctx.loading ?? false,
    };
  }

  protected repeatInjector(item: unknown, index: number): Injector {
    const rep = this.repeat()!;
    return Injector.create({
      providers: [
        {
          provide: REPEAT_SCOPE,
          useValue: { item, index, basePath: `${rep.statePath}/${index}` } satisfies RepeatScope,
        },
      ],
      parent: this.injector,
    });
  }

  private createEmitFn(el: UIElement): (event: string) => void {
    return (event: string) => {
      const bindings = el.on?.[event];
      if (!bindings) return;

      const bindingArray = Array.isArray(bindings) ? bindings : [bindings];
      for (const binding of bindingArray) {
        const handler = this.ctx.handlers?.[binding.action];
        if (handler) {
          handler(binding.params ?? {});
        }
      }
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx test render`

Expected: All tests PASS.

- [ ] **Step 5: Add to public-api.ts**

Add to `libs/render/src/public-api.ts`:

```typescript
// Components
export { RenderElementComponent } from './lib/render-element.component';
```

- [ ] **Step 6: Commit**

```bash
git add libs/render/src/
git commit -m "feat(render): add RenderElementComponent with recursive rendering"
```

---

### Task 8: RenderSpecComponent (Top-Level Entry)

**Files:**
- Create: `libs/render/src/lib/render-spec.component.ts`
- Create: `libs/render/src/lib/render-spec.component.spec.ts`
- Modify: `libs/render/src/public-api.ts`

- [ ] **Step 1: Write failing tests**

Create `libs/render/src/lib/render-spec.component.spec.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component, input } from '@angular/core';
import type { Spec } from '@json-render/core';
import { RenderSpecComponent } from './render-spec.component';
import { defineAngularRegistry } from './define-angular-registry';

@Component({
  selector: 'test-heading',
  standalone: true,
  template: '<h1>{{ props().text }}</h1>',
})
class TestHeadingComponent {
  props = input.required<Record<string, unknown>>();
}

@Component({
  selector: 'test-paragraph',
  standalone: true,
  template: '<p>{{ props().text }}</p>',
})
class TestParagraphComponent {
  props = input.required<Record<string, unknown>>();
}

describe('RenderSpecComponent', () => {
  const registry = defineAngularRegistry({
    Heading: TestHeadingComponent,
    Paragraph: TestParagraphComponent,
  });

  it('should render a spec with a single root element', () => {
    const spec: Spec = {
      root: 'h1',
      elements: {
        h1: { type: 'Heading', props: { text: 'Hello World' } },
      },
    };

    TestBed.configureTestingModule({
      imports: [RenderSpecComponent],
    });

    const fixture = TestBed.createComponent(RenderSpecComponent);
    fixture.componentRef.setInput('spec', spec);
    fixture.componentRef.setInput('registry', registry);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Hello World');
  });

  it('should render null spec as empty', () => {
    TestBed.configureTestingModule({
      imports: [RenderSpecComponent],
    });

    const fixture = TestBed.createComponent(RenderSpecComponent);
    fixture.componentRef.setInput('spec', null);
    fixture.componentRef.setInput('registry', registry);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent.trim()).toBe('');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx test render`

Expected: FAIL — `RenderSpecComponent` not found.

- [ ] **Step 3: Implement RenderSpecComponent**

Create `libs/render/src/lib/render-spec.component.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  computed,
  effect,
  inject,
  input,
  ChangeDetectionStrategy,
  Injector,
} from '@angular/core';
import { createStateStore } from '@json-render/core';
import type { Spec, StateStore, ComputedFunction } from '@json-render/core';
import { RenderElementComponent } from './render-element.component';
import { RENDER_CONTEXT, type RenderContext } from './contexts/render-context';
import { RENDER_CONFIG } from './provide-render';
import { signalStateStore } from './signal-state-store';
import type { AngularRegistry } from './render.types';

@Component({
  selector: 'render-spec',
  standalone: true,
  imports: [RenderElementComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [],
  template: `
    @if (spec() && spec()!.root) {
      <render-element
        [elementKey]="spec()!.root"
        [spec]="spec()!"
      />
    }
  `,
})
export class RenderSpecComponent {
  /** The json-render spec to render. Accepts static or signal-updated specs for streaming. */
  readonly spec = input<Spec | null>(null);

  /** Component registry mapping spec type names to Angular components. */
  readonly registry = input<AngularRegistry>();

  /** External state store. If not provided, creates an internal signalStateStore from spec.state. */
  readonly store = input<StateStore>();

  /** Named functions for $computed prop expressions. */
  readonly functions = input<Record<string, ComputedFunction>>();

  /** Action handlers for event bindings. */
  readonly handlers = input<Record<string, (params: Record<string, unknown>) => unknown | Promise<unknown>>>();

  /** Whether the spec is currently streaming/loading. */
  readonly loading = input<boolean>(false);

  private readonly config = inject(RENDER_CONFIG, { optional: true });
  private readonly injector = inject(Injector);

  private internalStore: StateStore | undefined;

  protected readonly renderContext = computed<RenderContext | undefined>(() => {
    const registry = this.registry() ?? this.config?.registry;
    if (!registry) return undefined;

    const store = this.store() ?? this.config?.store ?? this.getOrCreateStore();

    return {
      registry,
      store,
      functions: this.functions() ?? this.config?.functions,
      handlers: this.handlers() ?? this.config?.handlers,
      loading: this.loading(),
    };
  });

  private getOrCreateStore(): StateStore {
    const specState = this.spec()?.state;
    if (!this.internalStore) {
      this.internalStore = createStateStore(specState ?? {});
    }
    return this.internalStore;
  }

  /**
   * We provide RENDER_CONTEXT dynamically via viewProviders so that
   * child RenderElementComponents can inject it.
   */
  static ngComponentDef: unknown;
}
```

**Note:** The above needs adjustment — we need to provide RENDER_CONTEXT to children. Update the component to use `viewProviders`:

Replace the template and add viewProviders logic. Actually, the cleaner approach is to wrap the child in an injector:

Update `libs/render/src/lib/render-spec.component.ts` — replace the template:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  computed,
  inject,
  input,
  ChangeDetectionStrategy,
  Injector,
  EnvironmentInjector,
  createEnvironmentInjector,
} from '@angular/core';
import { createStateStore } from '@json-render/core';
import type { Spec, StateStore, ComputedFunction } from '@json-render/core';
import { RenderElementComponent } from './render-element.component';
import { RENDER_CONTEXT, type RenderContext } from './contexts/render-context';
import { RENDER_CONFIG } from './provide-render';
import type { AngularRegistry } from './render.types';

@Component({
  selector: 'render-spec',
  standalone: true,
  imports: [RenderElementComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (currentSpec(); as s) {
      <render-element
        [elementKey]="s.root"
        [spec]="s"
      />
    }
  `,
})
export class RenderSpecComponent {
  readonly spec = input<Spec | null>(null);
  readonly registry = input<AngularRegistry>();
  readonly store = input<StateStore>();
  readonly functions = input<Record<string, ComputedFunction>>();
  readonly handlers = input<Record<string, (params: Record<string, unknown>) => unknown | Promise<unknown>>>();
  readonly loading = input<boolean>(false);

  private readonly config = inject(RENDER_CONFIG, { optional: true });
  private internalStore: StateStore | undefined;

  protected readonly currentSpec = computed(() => this.spec());

  /**
   * Provide RENDER_CONTEXT so all descendant RenderElementComponents
   * can inject it. Uses a factory so it stays reactive.
   */
  static {
    // Context is provided via the component's providers array below
  }

  private getOrCreateStore(): StateStore {
    if (!this.internalStore) {
      this.internalStore = createStateStore(this.spec()?.state ?? {});
    }
    return this.internalStore;
  }

  /** @internal — used by the providers factory */
  _buildContext(): RenderContext {
    const registry = this.registry() ?? this.config?.registry;
    if (!registry) {
      throw new Error(
        'RenderSpecComponent: No registry provided. Pass [registry] input or use provideRender().',
      );
    }
    return {
      registry,
      store: this.store() ?? this.config?.store ?? this.getOrCreateStore(),
      functions: this.functions() ?? this.config?.functions,
      handlers: this.handlers() ?? this.config?.handlers,
      loading: this.loading(),
    };
  }
}

// We provide RENDER_CONTEXT at the component level with a factory
// that reads from the component instance.
RenderSpecComponent = Component({
  selector: 'render-spec',
  standalone: true,
  imports: [RenderElementComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [
    {
      provide: RENDER_CONTEXT,
      useFactory: () => {
        // This will be resolved per-instance via the component
        // We handle this via an alternative pattern in the actual implementation
      },
    },
  ],
  template: `
    @if (currentSpec(); as s) {
      <render-element
        [elementKey]="s.root"
        [spec]="s"
      />
    }
  `,
})(RenderSpecComponent) as any;
```

**Actually**, the cleanest Angular 20+ pattern is to provide the context via the component's `providers` or `viewProviders` using `useExisting` with the component itself acting as the context. Let me simplify:

Create `libs/render/src/lib/render-spec.component.ts` (final version):

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  computed,
  inject,
  input,
  ChangeDetectionStrategy,
} from '@angular/core';
import { createStateStore } from '@json-render/core';
import type { Spec, StateStore, ComputedFunction } from '@json-render/core';
import { RenderElementComponent } from './render-element.component';
import { RENDER_CONTEXT, type RenderContext } from './contexts/render-context';
import { RENDER_CONFIG } from './provide-render';
import type { AngularRegistry } from './render.types';

@Component({
  selector: 'render-spec',
  standalone: true,
  imports: [RenderElementComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [
    {
      provide: RENDER_CONTEXT,
      useFactory: () => inject(RenderSpecComponent)._context(),
    },
  ],
  template: `
    @if (currentSpec(); as s) {
      <render-element [elementKey]="s.root" [spec]="s" />
    }
  `,
})
export class RenderSpecComponent {
  readonly spec = input<Spec | null>(null);
  readonly registry = input<AngularRegistry>();
  readonly store = input<StateStore>();
  readonly functions = input<Record<string, ComputedFunction>>();
  readonly handlers = input<Record<string, (params: Record<string, unknown>) => unknown | Promise<unknown>>>();
  readonly loading = input<boolean>(false);

  private readonly config = inject(RENDER_CONFIG, { optional: true });
  private internalStore: StateStore | undefined;

  protected readonly currentSpec = computed(() => this.spec());

  /** @internal */
  readonly _context = computed<RenderContext>(() => {
    const registry = this.registry() ?? this.config?.registry;
    if (!registry) {
      throw new Error('RenderSpecComponent: No registry provided. Pass [registry] input or use provideRender().');
    }
    return {
      registry,
      store: this.store() ?? this.config?.store ?? this.getOrCreateStore(),
      functions: this.functions() ?? this.config?.functions,
      handlers: this.handlers() ?? this.config?.handlers,
      loading: this.loading(),
    };
  });

  private getOrCreateStore(): StateStore {
    if (!this.internalStore) {
      this.internalStore = createStateStore(this.spec()?.state ?? {});
    }
    return this.internalStore;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx test render`

Expected: All tests PASS.

- [ ] **Step 5: Add to public-api.ts**

Add to `libs/render/src/public-api.ts`:

```typescript
export { RenderSpecComponent } from './lib/render-spec.component';
```

- [ ] **Step 6: Verify the library builds**

Run: `npx nx build render`

Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add libs/render/src/
git commit -m "feat(render): add RenderSpecComponent top-level entry point"
```

---

### Task 9: Children Rendering (Recursive ngTemplateOutlet)

**Files:**
- Modify: `libs/render/src/lib/render-element.component.ts`
- Modify: `libs/render/src/lib/render-element.component.spec.ts`

This task adds recursive child rendering — the core pattern from hashbrown.

- [ ] **Step 1: Add failing test for children rendering**

Add to `libs/render/src/lib/render-element.component.spec.ts`:

```typescript
it('should recursively render children', () => {
  const spec: Spec = {
    root: 'wrapper',
    elements: {
      wrapper: { type: 'Container', props: {}, children: ['child1', 'child2'] },
      child1: { type: 'Text', props: { label: 'First' } },
      child2: { type: 'Text', props: { label: 'Second' } },
    },
  };

  TestBed.configureTestingModule({
    imports: [RenderElementComponent],
    providers: [{ provide: RENDER_CONTEXT, useValue: createContext() }],
  });

  const fixture = TestBed.createComponent(RenderElementComponent);
  fixture.componentRef.setInput('elementKey', 'wrapper');
  fixture.componentRef.setInput('spec', spec);
  fixture.detectChanges();

  const text = fixture.nativeElement.textContent;
  expect(text).toContain('First');
  expect(text).toContain('Second');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test render`

Expected: FAIL — children not rendered (Container's `<ng-content>` receives nothing).

- [ ] **Step 3: Update RenderElementComponent to render children recursively**

Update the template in `libs/render/src/lib/render-element.component.ts` to use `ngTemplateOutlet` recursion for children:

The component needs to project child `render-element` instances into the parent component. Update the template to:

```typescript
template: `
  <ng-template #elementTemplate let-key="key" let-spec="spec">
    @if (resolveElement(key, spec); as resolved) {
      @if (resolved.visible) {
        <ng-container
          *ngComponentOutlet="resolved.component; inputs: resolved.inputs"
        >
        </ng-container>
      }
    }
  </ng-template>

  @if (isVisible()) {
    @if (componentClass(); as comp) {
      @if (childKeys().length === 0) {
        <ng-container *ngComponentOutlet="comp; inputs: resolvedInputs()" />
      } @else {
        <ng-container *ngComponentOutlet="comp; inputs: resolvedInputs(); content: childContent" />
      }
    }
  }
`,
```

**Note:** Angular's `NgComponentOutlet` content projection with dynamic children is complex. The recommended pattern for recursive rendering is to have child `<render-element>` instances rendered as siblings, and the parent component receives them via content projection.

A simpler, more robust approach: render children as sibling `<render-element>` instances after the parent, and let the parent component use `<ng-content>` to slot them in. Update the template:

```typescript
template: `
  @if (isVisible() && componentClass(); as comp) {
    <ng-container *ngComponentOutlet="comp; inputs: resolvedInputs()">
      @for (childKey of childKeys(); track childKey) {
        <render-element [elementKey]="childKey" [spec]="spec()" />
      }
    </ng-container>
  }
`,
```

**Note:** `NgComponentOutlet` doesn't support content projection via child elements in its body. The correct pattern is to use `ngProjectAs` or to have the rendered component use inputs instead of `<ng-content>`.

For the MVP, the simplest correct approach: **children are rendered as a flat list after the parent, and components that need children accept a `children` input (an array of rendered content)**. This matches json-render's flat structure. Update the approach:

Instead of content projection, rendered components receive their children as an input signal containing the child element keys. The component itself is responsible for rendering its children (or ignoring them). This is simpler and more correct for the json-render model.

Update the inputs passed to rendered components to include `childKeys`:

```typescript
protected readonly resolvedInputs = computed(() => {
  const el = this.element();
  if (!el) return {};
  // ... existing prop resolution ...
  return {
    props: resolvedProps,
    bindings: bindings ?? undefined,
    emit: this.createEmitFn(el),
    loading: this.ctx.loading ?? false,
    childKeys: el.children ?? [],
    spec: this.spec(),
  };
});
```

And add `childKeys` to the `AngularComponentInputs` interface. Then each registered component can use `<render-element>` to render its children:

```typescript
@Component({
  selector: 'my-card',
  standalone: true,
  imports: [RenderElementComponent],
  template: `
    <div class="card">
      @for (key of childKeys(); track key) {
        <render-element [elementKey]="key" [spec]="spec()" />
      }
    </div>
  `,
})
class CardComponent {
  props = input.required<Record<string, unknown>>();
  childKeys = input<string[]>([]);
  spec = input.required<Spec>();
}
```

This is the cleanest pattern. Update the implementation accordingly.

- [ ] **Step 4: Update render.types.ts to include childKeys and spec in inputs**

Add to `AngularComponentInputs` in `libs/render/src/lib/render.types.ts`:

```typescript
export interface AngularComponentInputs {
  props: Record<string, unknown>;
  bindings?: Record<string, string>;
  emit: (event: string) => void;
  loading?: boolean;
  /** Child element keys for recursive rendering */
  childKeys: string[];
  /** The full spec (needed by children to resolve their elements) */
  spec: Spec;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx nx test render`

Expected: All tests PASS (test components updated to accept new inputs).

- [ ] **Step 6: Commit**

```bash
git add libs/render/src/
git commit -m "feat(render): add recursive children rendering via childKeys input"
```

---

### Task 10: Visibility and State Integration Tests

**Files:**
- Modify: `libs/render/src/lib/render-spec.component.spec.ts`

- [ ] **Step 1: Add integration tests for visibility conditions**

Add to `libs/render/src/lib/render-spec.component.spec.ts`:

```typescript
it('should hide elements when visible condition is false', () => {
  const spec: Spec = {
    root: 'heading',
    elements: {
      heading: {
        type: 'Heading',
        props: { text: 'Hidden' },
        visible: { $state: '/show', eq: true },
      },
    },
    state: { show: false },
  };

  TestBed.configureTestingModule({ imports: [RenderSpecComponent] });
  const fixture = TestBed.createComponent(RenderSpecComponent);
  fixture.componentRef.setInput('spec', spec);
  fixture.componentRef.setInput('registry', registry);
  fixture.detectChanges();

  expect(fixture.nativeElement.textContent.trim()).toBe('');
});

it('should show elements when visible condition is true', () => {
  const spec: Spec = {
    root: 'heading',
    elements: {
      heading: {
        type: 'Heading',
        props: { text: 'Visible' },
        visible: { $state: '/show', eq: true },
      },
    },
    state: { show: true },
  };

  TestBed.configureTestingModule({ imports: [RenderSpecComponent] });
  const fixture = TestBed.createComponent(RenderSpecComponent);
  fixture.componentRef.setInput('spec', spec);
  fixture.componentRef.setInput('registry', registry);
  fixture.detectChanges();

  expect(fixture.nativeElement.textContent).toContain('Visible');
});

it('should resolve $state prop expressions', () => {
  const store = createStateStore({ title: 'Dynamic Title' });
  const spec: Spec = {
    root: 'heading',
    elements: {
      heading: { type: 'Heading', props: { text: { $state: '/title' } } },
    },
  };

  TestBed.configureTestingModule({ imports: [RenderSpecComponent] });
  const fixture = TestBed.createComponent(RenderSpecComponent);
  fixture.componentRef.setInput('spec', spec);
  fixture.componentRef.setInput('registry', registry);
  fixture.componentRef.setInput('store', store);
  fixture.detectChanges();

  expect(fixture.nativeElement.textContent).toContain('Dynamic Title');
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx nx test render`

Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add libs/render/src/
git commit -m "test(render): add integration tests for visibility and state resolution"
```

---

### Task 11: Full Build Verification and Final Export

**Files:**
- Modify: `libs/render/src/public-api.ts`

- [ ] **Step 1: Finalize public-api.ts**

Ensure `libs/render/src/public-api.ts` contains all exports:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

// Types
export type {
  AngularComponentInputs,
  AngularComponentRenderer,
  AngularRegistry,
  RenderConfig,
} from './lib/render.types';

// Registry
export { defineAngularRegistry } from './lib/define-angular-registry';

// State
export { signalStateStore } from './lib/signal-state-store';

// Provider
export { provideRender, RENDER_CONFIG } from './lib/provide-render';

// Components
export { RenderSpecComponent } from './lib/render-spec.component';
export { RenderElementComponent } from './lib/render-element.component';

// Contexts (for advanced use / custom renderers)
export { RENDER_CONTEXT } from './lib/contexts/render-context';
export type { RenderContext } from './lib/contexts/render-context';
export { REPEAT_SCOPE } from './lib/contexts/repeat-scope';
export type { RepeatScope } from './lib/contexts/repeat-scope';
```

- [ ] **Step 2: Run all tests**

Run: `npx nx test render`

Expected: All tests PASS.

- [ ] **Step 3: Run lint**

Run: `npx nx lint render`

Expected: No errors.

- [ ] **Step 4: Run build**

Run: `npx nx build render`

Expected: Build succeeds, output in `dist/libs/render/`.

- [ ] **Step 5: Commit**

```bash
git add libs/render/
git commit -m "feat(render): finalize public API and verify build"
```

---

## Summary

| Task | Description | Tests |
|------|-------------|-------|
| 1 | Scaffold Nx library | Build + test runner verification |
| 2 | Types + defineAngularRegistry | 3 unit tests |
| 3 | signalStateStore | 6 unit tests |
| 4 | DI context tokens | No tests (pure types) |
| 5 | Reactive prop resolution | 3 unit tests |
| 6 | provideRender | 2 unit tests |
| 7 | RenderElementComponent | 2 unit tests |
| 8 | RenderSpecComponent | 2 unit tests |
| 9 | Children rendering (recursive) | 1 integration test |
| 10 | Visibility + state integration | 3 integration tests |
| 11 | Final build verification | Full build + lint |
