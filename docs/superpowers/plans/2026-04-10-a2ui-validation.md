# A2UI Validation — v0.9 Spec Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the A2UI validation system with the v0.9 spec's `CheckRule` shape, build a complete function evaluation engine with all 14 basic catalog functions, and wire pre-computed validation results into catalog components with inline error display.

**Architecture:** Replace `A2uiCheck` with v0.9 `A2uiCheckRule` (`{ condition: DynamicBoolean, message }`). Merge the 5 validation functions from `validate.ts` into the unified `FUNCTIONS` registry in `functions.ts`, add `formatString`, and add array resolution to `resolveDynamic()`. Replace `validateChecks()` with `evaluateCheckRules()` that uses `resolveDynamic()` for recursive condition evaluation. In `surfaceToSpec()`, evaluate checks and attach pre-computed `validationResult` props. Create a shared `A2uiValidationErrorsComponent` and update all `Checkable` catalog components.

**Tech Stack:** Angular 19 (signals, inputs), Vitest, `@cacheplane/a2ui`, `@cacheplane/chat`, `@cacheplane/render`

---

### Task 1: Align types — `A2uiCheck` to `A2uiCheckRule`

**Files:**
- Modify: `libs/a2ui/src/lib/types.ts:51-58,66`
- Modify: `libs/a2ui/src/index.ts:6,11`

- [ ] **Step 1: Update the type definition**

In `libs/a2ui/src/lib/types.ts`, replace the `A2uiCheck` interface (lines 51-58) with:

```typescript
// --- Validation (v0.9 CheckRule) ---

export interface A2uiCheckRule {
  condition: DynamicBoolean;
  message: string;
}
```

And update `A2uiComponent.checks` on line 66 from `A2uiCheck[]` to `A2uiCheckRule[]`:

```typescript
export interface A2uiComponent {
  id: string;
  component: string;
  children?: A2uiChildList;
  action?: A2uiAction;
  checks?: A2uiCheckRule[];
  [key: string]: unknown;
}
```

- [ ] **Step 2: Update the public API export**

In `libs/a2ui/src/index.ts`, replace `A2uiCheck` with `A2uiCheckRule` in the type export on line 6:

```typescript
export type {
  A2uiTheme, A2uiPathRef, A2uiFunctionCall,
  DynamicValue, DynamicString, DynamicNumber, DynamicBoolean, DynamicStringList,
  A2uiChildTemplate, A2uiChildList,
  A2uiEventAction, A2uiLocalAction, A2uiAction, A2uiCheckRule,
  A2uiComponent,
  A2uiCreateSurface, A2uiUpdateComponents, A2uiUpdateDataModel, A2uiDeleteSurface,
  A2uiMessage, A2uiSurface,
} from './lib/types';
```

- [ ] **Step 3: Run type check to see what breaks**

Run: `npx nx run a2ui:build 2>&1 | tail -20`

Expected: Compilation errors in `validate.ts`, `validate.spec.ts`, `button.component.ts`, and `surface.component.spec.ts` referencing the old `A2uiCheck` type. These will be fixed in subsequent tasks.

- [ ] **Step 4: Commit**

```bash
git add libs/a2ui/src/lib/types.ts libs/a2ui/src/index.ts
git commit -m "feat(a2ui): align A2uiCheck to v0.9 CheckRule shape as A2uiCheckRule"
```

---

### Task 2: Merge validation functions into unified `FUNCTIONS` registry and add `formatString`

**Files:**
- Modify: `libs/a2ui/src/lib/functions.ts:1-47`
- Modify: `libs/a2ui/src/lib/functions.spec.ts:1-43`

- [ ] **Step 1: Write failing tests for the new functions**

Replace the full file `libs/a2ui/src/lib/functions.spec.ts` with:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { executeFunction } from './functions';

const model = { name: 'Alice', price: 1234.5, date: '2026-04-09', count: 1 };

describe('executeFunction', () => {
  // --- Validation functions ---
  it('required passes for non-empty string', () => {
    expect(executeFunction('required', { value: 'hello' }, model)).toBe(true);
  });

  it('required fails for empty string', () => {
    expect(executeFunction('required', { value: '' }, model)).toBe(false);
  });

  it('required fails for null', () => {
    expect(executeFunction('required', { value: null }, model)).toBe(false);
  });

  it('required fails for undefined', () => {
    expect(executeFunction('required', { value: undefined }, model)).toBe(false);
  });

  it('regex passes for matching pattern', () => {
    expect(executeFunction('regex', { value: 'abc123', pattern: '^[a-z]+\\d+$' }, model)).toBe(true);
  });

  it('regex fails for non-matching pattern', () => {
    expect(executeFunction('regex', { value: '!!!', pattern: '^\\w+$' }, model)).toBe(false);
  });

  it('length passes within range', () => {
    expect(executeFunction('length', { value: 'hello', min: 3, max: 10 }, model)).toBe(true);
  });

  it('length fails below min', () => {
    expect(executeFunction('length', { value: 'hi', min: 3 }, model)).toBe(false);
  });

  it('length fails above max', () => {
    expect(executeFunction('length', { value: 'toolong', max: 3 }, model)).toBe(false);
  });

  it('numeric passes in range', () => {
    expect(executeFunction('numeric', { value: 5, min: 0, max: 10 }, model)).toBe(true);
  });

  it('numeric fails out of range', () => {
    expect(executeFunction('numeric', { value: 20, min: 0, max: 10 }, model)).toBe(false);
  });

  it('numeric fails for NaN', () => {
    expect(executeFunction('numeric', { value: 'abc' }, model)).toBe(false);
  });

  it('email passes for valid email', () => {
    expect(executeFunction('email', { value: 'a@b.com' }, model)).toBe(true);
  });

  it('email fails for invalid email', () => {
    expect(executeFunction('email', { value: 'not-email' }, model)).toBe(false);
  });

  // --- Formatting functions ---
  it('formatString interpolates args', () => {
    expect(executeFunction('formatString', { template: 'Hello ${name}!', name: 'Alice' }, model)).toBe('Hello Alice!');
  });

  it('formatString handles missing args', () => {
    expect(executeFunction('formatString', { template: 'Hello ${name}!' }, model)).toBe('Hello !');
  });

  it('formatNumber with grouping', () => {
    expect(executeFunction('formatNumber', { value: 1234, grouping: true }, model)).toMatch(/1.234/);
  });

  it('formatNumber with precision', () => {
    expect(executeFunction('formatNumber', { value: 1234.5, precision: 2 }, model)).toBe('1234.50');
  });

  it('formatCurrency formats as USD by default', () => {
    const result = executeFunction('formatCurrency', { value: 9.99 }, model) as string;
    expect(result).toContain('9.99');
  });

  it('formatDate returns a date string', () => {
    const result = executeFunction('formatDate', { value: '2026-04-09' }, model);
    expect(typeof result).toBe('string');
    expect(result).toBeTruthy();
  });

  it('pluralize singular', () => {
    expect(executeFunction('pluralize', { count: 1, singular: 'item', plural: 'items' }, model)).toBe('item');
  });

  it('pluralize plural', () => {
    expect(executeFunction('pluralize', { count: 3, singular: 'item', plural: 'items' }, model)).toBe('items');
  });

  // --- Logic functions ---
  it('and returns true when all truthy (object args)', () => {
    expect(executeFunction('and', { a: true, b: true }, model)).toBe(true);
  });

  it('and returns false when any falsy (object args)', () => {
    expect(executeFunction('and', { a: true, b: false }, model)).toBe(false);
  });

  it('and returns true for values array all truthy', () => {
    expect(executeFunction('and', { values: [true, true, true] }, model)).toBe(true);
  });

  it('and returns false for values array with falsy', () => {
    expect(executeFunction('and', { values: [true, false, true] }, model)).toBe(false);
  });

  it('or returns true when any truthy', () => {
    expect(executeFunction('or', { a: false, b: true }, model)).toBe(true);
  });

  it('or returns true for values array with any truthy', () => {
    expect(executeFunction('or', { values: [false, true, false] }, model)).toBe(true);
  });

  it('or returns false for values array all falsy', () => {
    expect(executeFunction('or', { values: [false, false] }, model)).toBe(false);
  });

  it('not inverts boolean', () => {
    expect(executeFunction('not', { value: true }, model)).toBe(false);
  });

  // --- Navigation ---
  it('openUrl returns null (no window in test)', () => {
    expect(executeFunction('openUrl', { url: 'https://example.com' }, model)).toBeNull();
  });

  // --- Unknown ---
  it('returns null for unknown function', () => {
    expect(executeFunction('unknownFn', {}, model)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify the new validation function tests fail**

Run: `npx nx test a2ui -- --reporter=verbose 2>&1 | tail -30`

Expected: New tests for `required`, `regex`, `length`, `numeric`, `email`, `formatString` FAIL. Existing tests should still pass.

- [ ] **Step 3: Add validation functions and `formatString` to the unified registry**

Replace the full file `libs/a2ui/src/lib/functions.ts` with:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

type FnExecutor = (args: Record<string, unknown>, model: Record<string, unknown>) => unknown;

const FUNCTIONS: Record<string, FnExecutor> = {
  // Validation functions
  required: (args) => args['value'] != null && String(args['value']).trim() !== '',
  regex: (args) => new RegExp(String(args['pattern'])).test(String(args['value'] ?? '')),
  length: (args) => {
    const len = String(args['value'] ?? '').length;
    return len >= Number(args['min'] ?? 0) && len <= Number(args['max'] ?? Infinity);
  },
  numeric: (args) => {
    const n = Number(args['value']);
    return !isNaN(n) && n >= Number(args['min'] ?? -Infinity) && n <= Number(args['max'] ?? Infinity);
  },
  email: (args) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(args['value'] ?? '')),

  // Formatting functions
  formatString: (args) => {
    const template = String(args['template'] ?? '');
    return template.replace(/\$\{(\w+)\}/g, (_, key) => String(args[key] ?? ''));
  },
  formatNumber: (args) => {
    const n = Number(args['value']);
    const precision = Number(args['precision'] ?? 0);
    if (args['grouping']) {
      return n.toLocaleString(undefined, { minimumFractionDigits: precision, maximumFractionDigits: precision });
    }
    return n.toFixed(precision);
  },
  formatCurrency: (args) => {
    return Number(args['value']).toLocaleString(
      String(args['locale'] ?? 'en-US'),
      { style: 'currency', currency: String(args['currency'] ?? 'USD') },
    );
  },
  formatDate: (args) => {
    return new Date(String(args['value'])).toLocaleDateString(
      String(args['locale'] ?? undefined),
    );
  },
  pluralize: (args) => {
    return Number(args['count']) === 1 ? String(args['singular']) : String(args['plural']);
  },

  // Logic functions
  and: (args) => {
    const values = args['values'];
    return Array.isArray(values) ? values.every(Boolean) : Object.values(args).every(Boolean);
  },
  or: (args) => {
    const values = args['values'];
    return Array.isArray(values) ? values.some(Boolean) : Object.values(args).some(Boolean);
  },
  not: (args) => !args['value'],

  // Navigation
  openUrl: (args) => {
    if (typeof globalThis.window !== 'undefined') {
      globalThis.window.open(String(args['url']), '_blank');
    }
    return null;
  },
};

export function executeFunction(
  name: string,
  args: Record<string, unknown>,
  model: Record<string, unknown>,
): unknown {
  const fn = FUNCTIONS[name];
  if (!fn) return null;
  return fn(args, model);
}
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `npx nx test a2ui -- --reporter=verbose --testPathPattern=functions 2>&1 | tail -30`

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add libs/a2ui/src/lib/functions.ts libs/a2ui/src/lib/functions.spec.ts
git commit -m "feat(a2ui): add validation functions and formatString to unified registry"
```

---

### Task 3: Add array resolution to `resolveDynamic()`

**Files:**
- Modify: `libs/a2ui/src/lib/resolve.ts:42-73`
- Modify: `libs/a2ui/src/lib/resolve.spec.ts`

- [ ] **Step 1: Write failing tests for array resolution**

Add the following tests at the end of the `describe('resolveDynamic', ...)` block in `libs/a2ui/src/lib/resolve.spec.ts`:

```typescript
  it('resolves arrays by recursing into each element', () => {
    const arr = [
      { path: '/user/name' },
      'literal',
      42,
    ];
    expect(resolveDynamic(arr, model)).toEqual(['Alice', 'literal', 42]);
  });

  it('resolves nested function calls in arrays', () => {
    const arr = [
      { call: 'pluralize', args: { count: 1, singular: 'cat', plural: 'cats' } },
      { call: 'pluralize', args: { count: 2, singular: 'dog', plural: 'dogs' } },
    ];
    expect(resolveDynamic(arr, model)).toEqual(['cat', 'dogs']);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx test a2ui -- --reporter=verbose --testPathPattern=resolve 2>&1 | tail -20`

Expected: The two new tests FAIL — arrays currently pass through as literals without resolving elements.

- [ ] **Step 3: Add array handling to `resolveDynamic()`**

In `libs/a2ui/src/lib/resolve.ts`, add the following block inside `resolveDynamic()` after the `if (value == null)` check (after line 47) and before the `isPathRef` check:

```typescript
  // Array — recurse into each element
  if (Array.isArray(value)) {
    return value.map(item => resolveDynamic(item, model, scope));
  }
```

The full function should now read:

```typescript
export function resolveDynamic(
  value: unknown,
  model: Record<string, unknown>,
  scope?: A2uiScope,
): unknown {
  if (value == null) return value;

  // Array — recurse into each element
  if (Array.isArray(value)) {
    return value.map(item => resolveDynamic(item, model, scope));
  }

  // Path reference
  if (isPathRef(value)) {
    return resolvePathRef(value, model, scope);
  }

  // Function call — execute registered function
  if (isFunctionCall(value)) {
    const fc = value as A2uiFunctionCall;
    // Resolve args that may themselves be dynamic
    const resolvedArgs: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fc.args)) {
      resolvedArgs[k] = resolveDynamic(v, model, scope);
    }
    const result = executeFunction(fc.call, resolvedArgs, model);
    return result ?? `[${fc.call}]`;
  }

  // Template string interpolation
  if (typeof value === 'string' && value.includes('${')) {
    return interpolateTemplate(value, model, scope);
  }

  // Literal passthrough
  return value;
}
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `npx nx test a2ui -- --reporter=verbose --testPathPattern=resolve 2>&1 | tail -20`

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add libs/a2ui/src/lib/resolve.ts libs/a2ui/src/lib/resolve.spec.ts
git commit -m "feat(a2ui): add array resolution to resolveDynamic for nested DynamicValue arrays"
```

---

### Task 4: Replace `validateChecks()` with `evaluateCheckRules()`

**Files:**
- Modify: `libs/a2ui/src/lib/validate.ts:1-37`
- Modify: `libs/a2ui/src/lib/validate.spec.ts:1-71`
- Modify: `libs/a2ui/src/index.ts:17-18`

- [ ] **Step 1: Write the new tests**

Replace the full file `libs/a2ui/src/lib/validate.spec.ts` with:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { evaluateCheckRules } from './validate';
import type { A2uiCheckRule } from './types';

describe('evaluateCheckRules', () => {
  const model = { name: 'Alice', email: 'alice@example.com', zip: '', agreed: true };

  it('passes when condition evaluates to true', () => {
    const checks: A2uiCheckRule[] = [
      { condition: { call: 'required', args: { value: { path: '/name' } } }, message: 'Name required' },
    ];
    expect(evaluateCheckRules(checks, model)).toEqual({ valid: true, errors: [] });
  });

  it('fails when condition evaluates to false', () => {
    const checks: A2uiCheckRule[] = [
      { condition: { call: 'required', args: { value: { path: '/zip' } } }, message: 'Zip required' },
    ];
    expect(evaluateCheckRules(checks, model)).toEqual({ valid: false, errors: ['Zip required'] });
  });

  it('resolves path references in condition args', () => {
    const checks: A2uiCheckRule[] = [
      { condition: { call: 'email', args: { value: { path: '/email' } } }, message: 'Invalid email' },
    ];
    expect(evaluateCheckRules(checks, model)).toEqual({ valid: true, errors: [] });
  });

  it('supports boolean literal conditions', () => {
    const checks: A2uiCheckRule[] = [
      { condition: true, message: 'Always passes' },
    ];
    expect(evaluateCheckRules(checks, model)).toEqual({ valid: true, errors: [] });
  });

  it('supports path ref conditions (boolean in data model)', () => {
    const checks: A2uiCheckRule[] = [
      { condition: { path: '/agreed' }, message: 'Must agree' },
    ];
    expect(evaluateCheckRules(checks, model)).toEqual({ valid: true, errors: [] });
  });

  it('handles falsy path ref conditions', () => {
    const modelWithFalse = { ...model, agreed: false };
    const checks: A2uiCheckRule[] = [
      { condition: { path: '/agreed' }, message: 'Must agree' },
    ];
    expect(evaluateCheckRules(checks, modelWithFalse)).toEqual({ valid: false, errors: ['Must agree'] });
  });

  it('supports nested and/or composition', () => {
    const checks: A2uiCheckRule[] = [
      {
        condition: {
          call: 'and',
          args: {
            values: [
              { call: 'required', args: { value: { path: '/name' } } },
              { call: 'email', args: { value: { path: '/email' } } },
            ],
          },
        },
        message: 'Name and valid email required',
      },
    ];
    expect(evaluateCheckRules(checks, model)).toEqual({ valid: true, errors: [] });
  });

  it('nested and fails when inner condition fails', () => {
    const checks: A2uiCheckRule[] = [
      {
        condition: {
          call: 'and',
          args: {
            values: [
              { call: 'required', args: { value: { path: '/name' } } },
              { call: 'required', args: { value: { path: '/zip' } } },
            ],
          },
        },
        message: 'All fields required',
      },
    ];
    expect(evaluateCheckRules(checks, model)).toEqual({ valid: false, errors: ['All fields required'] });
  });

  it('collects multiple errors from multiple checks', () => {
    const checks: A2uiCheckRule[] = [
      { condition: { call: 'required', args: { value: { path: '/zip' } } }, message: 'Zip required' },
      { condition: false, message: 'Always fails' },
    ];
    const result = evaluateCheckRules(checks, model);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(['Zip required', 'Always fails']);
  });

  it('returns valid for empty checks array', () => {
    expect(evaluateCheckRules([], model)).toEqual({ valid: true, errors: [] });
  });

  it('supports regex with path-resolved value', () => {
    const checks: A2uiCheckRule[] = [
      {
        condition: { call: 'regex', args: { value: { path: '/name' }, pattern: '^[A-Z]' } },
        message: 'Must start with uppercase',
      },
    ];
    expect(evaluateCheckRules(checks, model)).toEqual({ valid: true, errors: [] });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx test a2ui -- --reporter=verbose --testPathPattern=validate 2>&1 | tail -20`

Expected: FAIL — `evaluateCheckRules` does not exist yet, `A2uiCheck` import gone.

- [ ] **Step 3: Implement `evaluateCheckRules()`**

Replace the full file `libs/a2ui/src/lib/validate.ts` with:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { A2uiCheckRule } from './types';
import { resolveDynamic } from './resolve';

export interface A2uiValidationResult {
  valid: boolean;
  errors: string[];
}

export function evaluateCheckRules(
  checks: A2uiCheckRule[],
  model: Record<string, unknown>,
): A2uiValidationResult {
  const errors: string[] = [];
  for (const check of checks) {
    const result = resolveDynamic(check.condition, model);
    if (!result) errors.push(check.message);
  }
  return { valid: errors.length === 0, errors };
}
```

- [ ] **Step 4: Update the public API export**

In `libs/a2ui/src/index.ts`, replace lines 17-18:

```typescript
export { evaluateCheckRules } from './lib/validate';
export type { A2uiValidationResult } from './lib/validate';
```

- [ ] **Step 5: Run tests to verify all pass**

Run: `npx nx test a2ui -- --reporter=verbose 2>&1 | tail -30`

Expected: All tests PASS (functions, resolve, validate, parser, pointer)

- [ ] **Step 6: Commit**

```bash
git add libs/a2ui/src/lib/validate.ts libs/a2ui/src/lib/validate.spec.ts libs/a2ui/src/index.ts
git commit -m "feat(a2ui): replace validateChecks with evaluateCheckRules using resolveDynamic"
```

---

### Task 5: Wire `evaluateCheckRules()` into `surfaceToSpec()`

**Files:**
- Modify: `libs/chat/src/lib/a2ui/surface.component.ts:1-10,27,60-63`
- Modify: `libs/chat/src/lib/a2ui/surface.component.spec.ts`

- [ ] **Step 1: Write failing tests for `validationResult` in spec output**

Add the following describe block at the end of `libs/chat/src/lib/a2ui/surface.component.spec.ts`:

```typescript
describe('surfaceToSpec — validation', () => {
  function makeSurface(components: A2uiComponent[], dataModel: Record<string, unknown> = {}): A2uiSurface {
    const map = new Map<string, A2uiComponent>();
    for (const c of components) map.set(c.id, c);
    return { surfaceId: 's1', catalogId: 'basic', components: map, dataModel };
  }

  it('evaluates checks and attaches validationResult prop', () => {
    const surface = makeSurface(
      [
        {
          id: 'root', component: 'TextField', label: 'Name',
          value: { path: '/name' },
          checks: [
            { condition: { call: 'required', args: { value: { path: '/name' } } }, message: 'Name required' },
          ],
        },
      ],
      { name: 'Alice' },
    );
    const spec = surfaceToSpec(surface)!;
    expect(spec.elements['root'].props['validationResult']).toEqual({ valid: true, errors: [] });
  });

  it('attaches failing validationResult when check fails', () => {
    const surface = makeSurface(
      [
        {
          id: 'root', component: 'TextField', label: 'Name',
          value: { path: '/name' },
          checks: [
            { condition: { call: 'required', args: { value: { path: '/name' } } }, message: 'Name required' },
          ],
        },
      ],
      { name: '' },
    );
    const spec = surfaceToSpec(surface)!;
    expect(spec.elements['root'].props['validationResult']).toEqual({ valid: false, errors: ['Name required'] });
  });

  it('evaluates composite and condition', () => {
    const surface = makeSurface(
      [
        {
          id: 'root', component: 'Button', label: 'Submit',
          checks: [
            {
              condition: {
                call: 'and',
                args: {
                  values: [
                    { call: 'required', args: { value: { path: '/name' } } },
                    { call: 'email', args: { value: { path: '/email' } } },
                  ],
                },
              },
              message: 'All fields required',
            },
          ],
        },
      ],
      { name: 'Alice', email: 'alice@example.com' },
    );
    const spec = surfaceToSpec(surface)!;
    expect(spec.elements['root'].props['validationResult']).toEqual({ valid: true, errors: [] });
  });

  it('does not attach validationResult when no checks defined', () => {
    const surface = makeSurface([
      { id: 'root', component: 'Text', text: 'Hello' },
    ]);
    const spec = surfaceToSpec(surface)!;
    expect(spec.elements['root'].props['validationResult']).toBeUndefined();
  });

  it('does not pass raw checks as props', () => {
    const surface = makeSurface(
      [
        {
          id: 'root', component: 'TextField', label: 'Name',
          checks: [
            { condition: { call: 'required', args: { value: { path: '/name' } } }, message: 'Required' },
          ],
        },
      ],
      { name: 'Alice' },
    );
    const spec = surfaceToSpec(surface)!;
    expect(spec.elements['root'].props['checks']).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify the new tests fail**

Run: `npx nx test chat -- --reporter=verbose --testPathPattern=surface 2>&1 | tail -20`

Expected: FAIL — `validationResult` prop is not attached, raw `checks` prop is still being passed.

- [ ] **Step 3: Update `surfaceToSpec()` to evaluate checks**

In `libs/chat/src/lib/a2ui/surface.component.ts`, add the import for `evaluateCheckRules` at the top (line 7):

```typescript
import { resolveDynamic, getByPointer, evaluateCheckRules } from '@cacheplane/a2ui';
```

Then replace the checks passthrough block (lines 60-63):

```typescript
    // Pass checks through
    if (comp.checks) {
      props['checks'] = comp.checks;
    }
```

With:

```typescript
    // Evaluate checks and attach pre-computed validation result
    if (comp.checks) {
      props['validationResult'] = evaluateCheckRules(comp.checks, surface.dataModel);
    }
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `npx nx test chat -- --reporter=verbose --testPathPattern=surface 2>&1 | tail -20`

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/a2ui/surface.component.ts libs/chat/src/lib/a2ui/surface.component.spec.ts
git commit -m "feat(chat): evaluate checks in surfaceToSpec, attach pre-computed validationResult"
```

---

### Task 6: Create shared `A2uiValidationErrorsComponent`

**Files:**
- Create: `libs/chat/src/lib/a2ui/catalog/validation-errors.component.ts`

- [ ] **Step 1: Create the shared component**

Create `libs/chat/src/lib/a2ui/catalog/validation-errors.component.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import type { A2uiValidationResult } from '@cacheplane/a2ui';

@Component({
  selector: 'a2ui-validation-errors',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!result().valid) {
      @for (error of result().errors; track error) {
        <p class="text-xs mt-1" style="color: var(--a2ui-error, #ef4444);">{{ error }}</p>
      }
    }
  `,
})
export class A2uiValidationErrorsComponent {
  readonly result = input<A2uiValidationResult>({ valid: true, errors: [] });
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx nx build chat 2>&1 | tail -10`

Expected: Build succeeds (component is not yet imported anywhere, but should compile cleanly).

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/lib/a2ui/catalog/validation-errors.component.ts
git commit -m "feat(chat): add shared A2uiValidationErrorsComponent for inline error display"
```

---

### Task 7: Update catalog components to use `validationResult`

**Files:**
- Modify: `libs/chat/src/lib/a2ui/catalog/button.component.ts:1-34`
- Modify: `libs/chat/src/lib/a2ui/catalog/text-field.component.ts:1-35`
- Modify: `libs/chat/src/lib/a2ui/catalog/check-box.component.ts:1-27`
- Modify: `libs/chat/src/lib/a2ui/catalog/choice-picker.component.ts:1-32`
- Modify: `libs/chat/src/lib/a2ui/catalog/slider.component.ts:1-39`
- Modify: `libs/chat/src/lib/a2ui/catalog/date-time-input.component.ts:1-39`

- [ ] **Step 1: Update `A2uiButtonComponent`**

Replace the full file `libs/chat/src/lib/a2ui/catalog/button.component.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import type { A2uiValidationResult } from '@cacheplane/a2ui';
import { A2uiValidationErrorsComponent } from './validation-errors.component';

@Component({
  selector: 'a2ui-button',
  standalone: true,
  imports: [A2uiValidationErrorsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      class="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
      [class]="variant() === 'borderless' ? 'bg-transparent hover:bg-white/10' : 'bg-blue-600 hover:bg-blue-700 text-white'"
      [disabled]="disabled() || !validationResult().valid"
      (click)="handleClick()"
    >{{ label() }}</button>
    <a2ui-validation-errors [result]="validationResult()" />
  `,
})
export class A2uiButtonComponent {
  readonly label = input<string>('');
  readonly variant = input<string>('primary');
  readonly disabled = input<boolean>(false);
  readonly validationResult = input<A2uiValidationResult>({ valid: true, errors: [] });
  readonly emit = input<(event: string) => void>(() => { /* noop */ });

  handleClick(): void {
    this.emit()('click');
  }
}
```

- [ ] **Step 2: Update `A2uiTextFieldComponent`**

Replace the full file `libs/chat/src/lib/a2ui/catalog/text-field.component.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import type { A2uiValidationResult } from '@cacheplane/a2ui';
import { A2uiValidationErrorsComponent } from './validation-errors.component';

@Component({
  selector: 'a2ui-text-field',
  standalone: true,
  imports: [A2uiValidationErrorsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-1">
      @if (label()) { <label class="text-xs" style="color: var(--a2ui-label, rgba(255,255,255,0.6));">{{ label() }}</label> }
      <input
        type="text"
        [value]="value()"
        [placeholder]="placeholder()"
        class="rounded-lg px-3 py-2 text-sm"
        [style.background]="'var(--a2ui-input-bg, rgba(255,255,255,0.05))'"
        [style.color]="'var(--a2ui-input-text, white)'"
        [style.border]="validationResult().valid ? '1px solid var(--a2ui-border, rgba(255,255,255,0.1))' : '1px solid var(--a2ui-error, #ef4444)'"
        (input)="onInput($event)"
      />
      <a2ui-validation-errors [result]="validationResult()" />
    </div>
  `,
})
export class A2uiTextFieldComponent {
  readonly label = input<string>('');
  readonly value = input<string>('');
  readonly placeholder = input<string>('');
  readonly validationResult = input<A2uiValidationResult>({ valid: true, errors: [] });
  readonly _bindings = input<Record<string, string>>({});
  readonly emit = input<(event: string) => void>(() => { /* noop */ });

  onInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    const path = this._bindings()?.['value'];
    if (path) {
      this.emit()(`a2ui:datamodel:${path}:${val}`);
    }
  }
}
```

- [ ] **Step 3: Update `A2uiCheckBoxComponent`**

Replace the full file `libs/chat/src/lib/a2ui/catalog/check-box.component.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import type { A2uiValidationResult } from '@cacheplane/a2ui';
import { A2uiValidationErrorsComponent } from './validation-errors.component';

@Component({
  selector: 'a2ui-check-box',
  standalone: true,
  imports: [A2uiValidationErrorsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      <label class="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" [checked]="checked()" (change)="onChange($event)" class="rounded" />
        {{ label() }}
      </label>
      <a2ui-validation-errors [result]="validationResult()" />
    </div>
  `,
})
export class A2uiCheckBoxComponent {
  readonly label = input<string>('');
  readonly checked = input<boolean>(false);
  readonly validationResult = input<A2uiValidationResult>({ valid: true, errors: [] });
  readonly _bindings = input<Record<string, string>>({});
  readonly emit = input<(event: string) => void>(() => { /* noop */ });

  onChange(event: Event): void {
    const val = (event.target as HTMLInputElement).checked;
    const path = this._bindings()?.['checked'];
    if (path) {
      this.emit()(`a2ui:datamodel:${path}:${val}`);
    }
  }
}
```

- [ ] **Step 4: Update `A2uiChoicePickerComponent`**

Replace the full file `libs/chat/src/lib/a2ui/catalog/choice-picker.component.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import type { A2uiValidationResult } from '@cacheplane/a2ui';
import { A2uiValidationErrorsComponent } from './validation-errors.component';

@Component({
  selector: 'a2ui-choice-picker',
  standalone: true,
  imports: [A2uiValidationErrorsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-1">
      @if (label()) { <label class="text-xs" style="color: var(--a2ui-label, rgba(255,255,255,0.6));">{{ label() }}</label> }
      <select
        class="rounded-lg px-3 py-2 text-sm"
        [style.background]="'var(--a2ui-input-bg, rgba(255,255,255,0.05))'"
        [style.color]="'var(--a2ui-input-text, white)'"
        [style.border]="validationResult().valid ? '1px solid var(--a2ui-border, rgba(255,255,255,0.1))' : '1px solid var(--a2ui-error, #ef4444)'"
        (change)="onChange($event)"
      >
        @for (opt of options(); track opt) {
          <option [selected]="opt === selected()">{{ opt }}</option>
        }
      </select>
      <a2ui-validation-errors [result]="validationResult()" />
    </div>
  `,
})
export class A2uiChoicePickerComponent {
  readonly label = input<string>('');
  readonly options = input<string[]>([]);
  readonly selected = input<string>('');
  readonly validationResult = input<A2uiValidationResult>({ valid: true, errors: [] });
  readonly _bindings = input<Record<string, string>>({});
  readonly emit = input<(event: string) => void>(() => { /* noop */ });

  onChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    const path = this._bindings()?.['selected'];
    if (path) {
      this.emit()(`a2ui:datamodel:${path}:${val}`);
    }
  }
}
```

- [ ] **Step 5: Update `A2uiSliderComponent`**

Replace the full file `libs/chat/src/lib/a2ui/catalog/slider.component.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import type { A2uiValidationResult } from '@cacheplane/a2ui';
import { A2uiValidationErrorsComponent } from './validation-errors.component';

@Component({
  selector: 'a2ui-slider',
  standalone: true,
  imports: [A2uiValidationErrorsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-1">
      @if (label()) {
        <label class="text-xs" style="color: var(--a2ui-label, rgba(255,255,255,0.6));">{{ label() }}: {{ value() }}</label>
      }
      <input
        type="range"
        [min]="min()"
        [max]="max()"
        [step]="step()"
        [value]="value()"
        class="w-full"
        (input)="onInput($event)"
      />
      <a2ui-validation-errors [result]="validationResult()" />
    </div>
  `,
})
export class A2uiSliderComponent {
  readonly label = input<string>('');
  readonly value = input<number>(0);
  readonly min = input<number>(0);
  readonly max = input<number>(100);
  readonly step = input<number>(1);
  readonly validationResult = input<A2uiValidationResult>({ valid: true, errors: [] });
  readonly _bindings = input<Record<string, string>>({});
  readonly emit = input<(event: string) => void>(() => { /* noop */ });

  onInput(event: Event): void {
    const val = Number((event.target as HTMLInputElement).value);
    const path = this._bindings()?.['value'];
    if (path) {
      this.emit()(`a2ui:datamodel:${path}:${val}`);
    }
  }
}
```

- [ ] **Step 6: Update `A2uiDateTimeInputComponent`**

Replace the full file `libs/chat/src/lib/a2ui/catalog/date-time-input.component.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import type { A2uiValidationResult } from '@cacheplane/a2ui';
import { A2uiValidationErrorsComponent } from './validation-errors.component';

@Component({
  selector: 'a2ui-date-time-input',
  standalone: true,
  imports: [A2uiValidationErrorsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-1">
      @if (label()) {
        <label class="text-xs" style="color: var(--a2ui-label, rgba(255,255,255,0.6));">{{ label() }}</label>
      }
      <input
        [type]="inputType()"
        [value]="value()"
        [min]="min()"
        [max]="max()"
        class="rounded-lg px-3 py-2 text-sm"
        [style.background]="'var(--a2ui-input-bg, rgba(255,255,255,0.05))'"
        [style.color]="'var(--a2ui-input-text, white)'"
        [style.border]="validationResult().valid ? '1px solid var(--a2ui-border, rgba(255,255,255,0.1))' : '1px solid var(--a2ui-error, #ef4444)'"
        (change)="onChange($event)"
      />
      <a2ui-validation-errors [result]="validationResult()" />
    </div>
  `,
})
export class A2uiDateTimeInputComponent {
  readonly label = input<string>('');
  readonly value = input<string>('');
  readonly inputType = input<'date' | 'time' | 'datetime-local'>('date');
  readonly min = input<string>('');
  readonly max = input<string>('');
  readonly validationResult = input<A2uiValidationResult>({ valid: true, errors: [] });
  readonly _bindings = input<Record<string, string>>({});
  readonly emit = input<(event: string) => void>(() => { /* noop */ });

  onChange(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    const path = this._bindings()?.['value'];
    if (path) {
      this.emit()(`a2ui:datamodel:${path}:${val}`);
    }
  }
}
```

- [ ] **Step 7: Run all chat tests to verify**

Run: `npx nx test chat -- --reporter=verbose 2>&1 | tail -30`

Expected: All tests PASS

- [ ] **Step 8: Commit**

```bash
git add libs/chat/src/lib/a2ui/catalog/button.component.ts libs/chat/src/lib/a2ui/catalog/text-field.component.ts libs/chat/src/lib/a2ui/catalog/check-box.component.ts libs/chat/src/lib/a2ui/catalog/choice-picker.component.ts libs/chat/src/lib/a2ui/catalog/slider.component.ts libs/chat/src/lib/a2ui/catalog/date-time-input.component.ts
git commit -m "feat(chat): update catalog components to use pre-computed validationResult"
```

---

### Task 8: Update cockpit example with v0.9 CheckRule validation

**Files:**
- Modify: `cockpit/chat/a2ui/python/src/graph.py:14-43`

- [ ] **Step 1: Update the contact form JSONL to include checks**

Replace the `CONTACT_FORM_JSONL` variable in `cockpit/chat/a2ui/python/src/graph.py` (lines 14-43):

```python
CONTACT_FORM_JSONL = A2UI_PREFIX + "\n" + "\n".join([
    json.dumps({"type": "createSurface", "surfaceId": "contact", "catalogId": "basic"}),
    json.dumps({"type": "updateDataModel", "surfaceId": "contact", "value": {
        "name": "", "email": "", "department": "Engineering", "consent": False,
    }}),
    json.dumps({"type": "updateComponents", "surfaceId": "contact", "components": [
        {"id": "root", "component": "Column", "children": ["card"]},
        {"id": "card", "component": "Card", "title": "Contact Us", "children": [
            "name_field", "email_field", "dept_picker", "consent_check", "divider", "submit_btn",
        ]},
        {"id": "name_field", "component": "TextField",
         "label": "Name", "value": {"path": "/name"}, "placeholder": "Your full name",
         "_bindings": {"value": "/name"},
         "checks": [
             {"condition": {"call": "required", "args": {"value": {"path": "/name"}}},
              "message": "Name is required"},
         ]},
        {"id": "email_field", "component": "TextField",
         "label": "Email", "value": {"path": "/email"}, "placeholder": "you@company.com",
         "_bindings": {"value": "/email"},
         "checks": [
             {"condition": {"call": "required", "args": {"value": {"path": "/email"}}},
              "message": "Email is required"},
             {"condition": {"call": "email", "args": {"value": {"path": "/email"}}},
              "message": "Must be a valid email address"},
         ]},
        {"id": "dept_picker", "component": "ChoicePicker",
         "label": "Department",
         "options": ["Engineering", "Sales", "Support", "Marketing"],
         "selected": {"path": "/department"},
         "_bindings": {"selected": "/department"}},
        {"id": "consent_check", "component": "CheckBox",
         "label": "I agree to be contacted", "checked": {"path": "/consent"},
         "_bindings": {"checked": "/consent"}},
        {"id": "divider", "component": "Divider"},
        {"id": "submit_btn", "component": "Button",
         "label": "Submit",
         "checks": [
             {"condition": {"call": "and", "args": {"values": [
                 {"call": "required", "args": {"value": {"path": "/name"}}},
                 {"call": "email", "args": {"value": {"path": "/email"}}},
                 {"path": "/consent"},
             ]}},
              "message": "Complete all required fields and agree to be contacted"},
         ],
         "action": {"event": {"name": "formSubmit", "context": {"formId": "contact"}}}},
    ]}),
])
```

- [ ] **Step 2: Verify the Python graph still works**

Run: `cd cockpit/chat/a2ui/python && python -c "from src.graph import graph; print('Graph compiled:', graph is not None)" 2>&1`

Expected: `Graph compiled: True`

- [ ] **Step 3: Commit**

```bash
git add cockpit/chat/a2ui/python/src/graph.py
git commit -m "feat(cockpit): add v0.9 CheckRule validation to A2UI contact form example"
```

---

### Task 9: Update documentation

**Files:**
- Modify: `apps/website/content/docs/chat/a2ui/overview.mdx`

- [ ] **Step 1: Add Validation section to A2UI overview**

In `apps/website/content/docs/chat/a2ui/overview.mdx`, add the following section before the `## What's Next` heading:

```markdown
## Validation

A2UI v0.9 uses `CheckRule` objects for client-side validation. Input components and buttons can define a `checks` array — each check has a `condition` (a `DynamicBoolean`) and an error `message`.

### CheckRule Shape

```json
{
  "checks": [
    {
      "condition": { "call": "required", "args": { "value": { "path": "/name" } } },
      "message": "Name is required"
    }
  ]
}
```

The `condition` can be:
- A **boolean literal**: `true` or `false`
- A **path reference**: `{ "path": "/agreed" }` — resolves to a data model value
- A **FunctionCall**: `{ "call": "required", "args": { ... } }` — invokes a named function
- A **composite**: `{ "call": "and", "args": { "values": [...] } }` — combines multiple conditions

### Built-in Functions

| Category | Functions |
|----------|-----------|
| Validation | `required`, `regex`, `length`, `numeric`, `email` |
| Logic | `and`, `or`, `not` |
| Formatting | `formatString`, `formatNumber`, `formatCurrency`, `formatDate`, `pluralize` |
| Navigation | `openUrl` |

### Input Component Behavior

Input components (`TextField`, `CheckBox`, `ChoicePicker`, `Slider`, `DateTimeInput`) validate continuously — errors display inline as the user interacts. The input border changes color to indicate validation state.

### Button Behavior

Per the v0.9 spec: if any check fails, the button is automatically disabled. Error messages display below the button.

### Composite Conditions

Use `and`, `or`, and `not` to compose complex validation rules:

```json
{
  "condition": {
    "call": "and",
    "args": {
      "values": [
        { "call": "required", "args": { "value": { "path": "/name" } } },
        { "call": "or", "args": { "values": [
          { "call": "required", "args": { "value": { "path": "/email" } } },
          { "call": "required", "args": { "value": { "path": "/phone" } } }
        ]}}
      ]
    }
  },
  "message": "Name required, plus email or phone"
}
```

### Custom Catalog Components

Custom catalog components receive a pre-computed `validationResult` prop:

```typescript
interface A2uiValidationResult {
  valid: boolean;
  errors: string[];
}
```

Use the shared `A2uiValidationErrorsComponent` for consistent error display:

```typescript
import { A2uiValidationErrorsComponent } from '@cacheplane/chat';

@Component({
  imports: [A2uiValidationErrorsComponent],
  template: `
    <input [value]="value()" />
    <a2ui-validation-errors [result]="validationResult()" />
  `,
})
export class MyCustomInputComponent {
  readonly value = input('');
  readonly validationResult = input<A2uiValidationResult>({ valid: true, errors: [] });
}
```

### Theming

Validation styling uses CSS custom properties:

| Property | Default | Usage |
|----------|---------|-------|
| `--a2ui-error` | `#ef4444` | Error text and invalid border color |
| `--a2ui-border` | `rgba(255,255,255,0.1)` | Default input border |
| `--a2ui-input-bg` | `rgba(255,255,255,0.05)` | Input background |
| `--a2ui-label` | `rgba(255,255,255,0.6)` | Label text color |
```

- [ ] **Step 2: Export `A2uiValidationErrorsComponent` from chat library**

Check whether `A2uiValidationErrorsComponent` needs to be exported for custom catalog components. Read the chat library's public API barrel file and add an export if needed.

- [ ] **Step 3: Commit**

```bash
git add apps/website/content/docs/chat/a2ui/overview.mdx
git commit -m "docs: add A2UI validation section with v0.9 CheckRule, functions, and theming"
```
