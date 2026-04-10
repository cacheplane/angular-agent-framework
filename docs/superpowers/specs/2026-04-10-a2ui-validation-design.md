# A2UI Validation — v0.9 Spec Alignment Design

**Date:** 2026-04-10
**Status:** Approved

## Overview

Align the A2UI validation system with the v0.9 spec's `CheckRule` shape, build a complete function evaluation engine covering all 14 basic catalog functions, and wire pre-computed validation results into catalog components with inline error display. This makes input components validate continuously and buttons auto-disable when checks fail, matching the v0.9 renderer contract.

## 1. Type Alignment — `A2uiCheck` to `A2uiCheckRule`

### Problem

Our `A2uiCheck` type uses a flattened `{ call, args, message }` shape. The v0.9 spec defines `CheckRule` as `{ condition: DynamicBoolean, message: string }` where `condition` is a `DynamicBoolean` — a boolean literal, a `{ path }` ref, or a `FunctionCall`. Our shape doesn't support composite conditions (`and`/`or`/`not`) or path-ref conditions.

### Solution

Replace `A2uiCheck` with `A2uiCheckRule`:

```typescript
// libs/a2ui/src/lib/types.ts

// Remove:
export interface A2uiCheck {
  call: string;
  args: Record<string, unknown>;
  message: string;
}

// Add:
export interface A2uiCheckRule {
  condition: DynamicBoolean;
  message: string;
}
```

`A2uiComponent.checks` changes from `A2uiCheck[]` to `A2uiCheckRule[]`. All references update across the codebase: public API exports in `libs/a2ui/src/index.ts`, `surfaceToSpec()`, `A2uiButtonComponent`, and `validateChecks`.

**v0.9 spec reference:** `common_types.json#/$defs/CheckRule` — `{ condition: DynamicBoolean, message: string }`. The `condition` field accepts:
- Boolean literal: `true` / `false`
- Path reference: `{ "path": "/formData/agreed" }`
- FunctionCall: `{ "call": "required", "args": { "value": { "path": "/name" } } }`
- Nested composition: `{ "call": "and", "args": { "values": [...] } }`

**Files:**
- `libs/a2ui/src/lib/types.ts` — rename type, update `A2uiComponent.checks`
- `libs/a2ui/src/index.ts` — update export
- All consumers of `A2uiCheck`

## 2. Function Evaluation Engine — All 14 Basic Catalog Functions

### Problem

Functions are split across two files with two registries:
- `functions.ts` has 8 functions: `formatNumber`, `formatCurrency`, `formatDate`, `pluralize`, `openUrl`, `and`, `or`, `not`
- `validate.ts` has 5 validators: `required`, `regex`, `length`, `numeric`, `email`

Missing: `formatString` (the 14th function). The split means validation can't use the recursive `resolveDynamic()` path, and `and`/`or`/`not` in `functions.ts` operate on pre-resolved args but aren't wired to validation.

### Solution

Merge all 14 functions into the single `FUNCTIONS` registry in `functions.ts`:

```typescript
// libs/a2ui/src/lib/functions.ts — unified registry

const FUNCTIONS: Record<string, FnExecutor> = {
  // Validation functions (moved from validate.ts)
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
```

**Key insight:** `resolveDynamic()` handles the recursion needed for nested `FunctionCall` conditions. A `condition` of `{ call: 'and', args: { values: [{ call: 'required', args: { value: { path: '/name' } } }] } }` resolves naturally: `resolveDynamic` resolves the nested args (path refs, nested function calls), then calls `executeFunction('and', resolvedArgs, model)`.

**Required fix:** `resolveDynamic()` currently doesn't recurse into arrays — an arg like `values: [{ call: 'required', ... }]` hits the literal passthrough. Add array handling:

```typescript
// libs/a2ui/src/lib/resolve.ts — inside resolveDynamic(), before literal passthrough
if (Array.isArray(value)) {
  return value.map(item => resolveDynamic(item, model, scope));
}
```

This enables `and`/`or` to receive arrays of resolved boolean values from nested function calls.

**`and`/`or` update:** The current `and`/`or` use `Object.values(args).every(Boolean)`. For v0.9, the `values` arg is an array of DynamicBooleans. After `resolveDynamic` resolves the array elements, `and` checks `args['values'].every(Boolean)`. We support both shapes for backwards compatibility.

**v0.9 spec reference:** `basic_catalog.json#/functions` — 14 named functions: `required`, `regex`, `length`, `numeric`, `email`, `formatString`, `formatNumber`, `formatCurrency`, `formatDate`, `pluralize`, `and`, `or`, `not`, `openUrl`.

**Files:**
- `libs/a2ui/src/lib/functions.ts` — add 6 functions (`required`, `regex`, `length`, `numeric`, `email`, `formatString`), update `and`/`or`
- `libs/a2ui/src/lib/resolve.ts` — add array handling in `resolveDynamic()` for nested DynamicValue arrays

## 3. `validate.ts` — Thin Wrapper Using `resolveDynamic`

### Problem

`validateChecks()` operates on the old `A2uiCheck` shape with flat args, no path resolution, no recursion.

### Solution

Replace with `evaluateCheckRules()` that uses `resolveDynamic` for condition evaluation:

```typescript
// libs/a2ui/src/lib/validate.ts
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

`resolveDynamic(check.condition, model)` handles all condition shapes:
- Boolean literal: returns the boolean
- Path ref `{ path: '/agreed' }`: resolves to data model value (truthy/falsy)
- FunctionCall `{ call: 'required', ... }`: resolves args recursively, executes function, returns boolean
- Nested `{ call: 'and', args: { values: [...] } }`: recursive resolution, then logical evaluation

**Public API change:** Export `evaluateCheckRules` and `A2uiCheckRule` instead of `validateChecks` and `A2uiCheck`.

**Files:**
- `libs/a2ui/src/lib/validate.ts` — replace `validateChecks` with `evaluateCheckRules`
- `libs/a2ui/src/index.ts` — update exports

## 4. `surfaceToSpec()` — Pre-computed Validation Results

### Problem

`surfaceToSpec()` currently passes raw `checks` through as props. Catalog components don't have access to the data model to resolve path refs in check args.

### Solution

Evaluate checks during spec conversion, attach pre-computed `validationResult` as a prop:

```typescript
// libs/chat/src/lib/a2ui/surface.component.ts — inside surfaceToSpec()

// Replace:
if (comp.checks) {
  props['checks'] = comp.checks;
}

// With:
if (comp.checks) {
  props['validationResult'] = evaluateCheckRules(comp.checks, surface.dataModel);
}
```

**Reactivity:** `surfaceToSpec()` runs inside a `computed` signal on `A2uiSurfaceComponent`. Any data model change (user typing, checkbox toggle, slider drag) re-triggers spec conversion, which re-evaluates all checks, producing fresh `validationResult` props. Continuous validation comes for free through Angular's signal reactivity.

**Custom catalog components** receive the same `validationResult: { valid: boolean, errors: string[] }` prop. They never need to import the evaluation engine or access the data model.

**Files:**
- `libs/chat/src/lib/a2ui/surface.component.ts` — replace raw checks passthrough with `evaluateCheckRules()` call

## 5. Shared Validation Errors Component

### Problem

Each catalog component would need to duplicate error rendering logic.

### Solution

A shared `A2uiValidationErrorsComponent` that any `Checkable` component includes:

```typescript
// libs/chat/src/lib/a2ui/catalog/validation-errors.component.ts
@Component({
  selector: 'a2ui-validation-errors',
  standalone: true,
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

**Theming:** Uses `--a2ui-error` CSS custom property, falling back to red. Inherits from the surface theme, consistent with the existing `--chat-*` pattern. No hardcoded colors in the final implementation — the fallback is for development only.

**Files:**
- `libs/chat/src/lib/a2ui/catalog/validation-errors.component.ts` — new file

## 6. Catalog Component Updates

### Input Components (Checkable)

All input components that inherit from the v0.9 `Checkable` mixin gain:
1. `validationResult` input with default `{ valid: true, errors: [] }`
2. `<a2ui-validation-errors [result]="validationResult()" />` in template

**Components updated:** `TextField`, `CheckBox`, `ChoicePicker`, `Slider`, `DateTimeInput`

Example for TextField:

```typescript
@Component({
  selector: 'a2ui-text-field',
  standalone: true,
  imports: [A2uiValidationErrorsComponent],
  template: `
    <div class="flex flex-col gap-1">
      @if (label()) { <label class="text-xs text-white/60">{{ label() }}</label> }
      <input
        type="text"
        [value]="value()"
        [placeholder]="placeholder()"
        class="bg-white/5 border rounded-lg px-3 py-2 text-sm text-white"
        [style.border-color]="validationResult().valid ? 'var(--a2ui-border, rgba(255,255,255,0.1))' : 'var(--a2ui-error, #ef4444)'"
        (input)="onInput($event)"
      />
      <a2ui-validation-errors [result]="validationResult()" />
    </div>
  `,
})
export class A2uiTextFieldComponent {
  readonly validationResult = input<A2uiValidationResult>({ valid: true, errors: [] });
  // ... existing inputs and methods
}
```

### Button

Button changes from calling `validateChecks()` locally to reading the pre-computed `validationResult`:

```typescript
@Component({
  selector: 'a2ui-button',
  standalone: true,
  imports: [A2uiValidationErrorsComponent],
  template: `
    <button
      [disabled]="disabled() || !validationResult().valid"
      (click)="handleClick()"
    >{{ label() }}</button>
    <a2ui-validation-errors [result]="validationResult()" />
  `,
})
export class A2uiButtonComponent {
  readonly validationResult = input<A2uiValidationResult>({ valid: true, errors: [] });
  // Remove: readonly checks = input<A2uiCheck[]>([]);
  // Remove: isValid() method
}
```

**v0.9 spec behavior:** "If any check fails, the button is automatically disabled on the client." Error messages display below the button.

**Files:**
- `libs/chat/src/lib/a2ui/catalog/text-field.component.ts`
- `libs/chat/src/lib/a2ui/catalog/check-box.component.ts`
- `libs/chat/src/lib/a2ui/catalog/choice-picker.component.ts`
- `libs/chat/src/lib/a2ui/catalog/slider.component.ts`
- `libs/chat/src/lib/a2ui/catalog/date-time-input.component.ts`
- `libs/chat/src/lib/a2ui/catalog/button.component.ts`

## 7. Cockpit Example Update

Update the contact form to demonstrate v0.9 `CheckRule` validation:

```python
# cockpit/chat/a2ui/python/src/graph.py
{"id": "name_field", "component": "TextField",
 "label": "Name", "value": {"path": "/name"},
 "_bindings": {"value": "/name"},
 "checks": [
   {"condition": {"call": "required", "args": {"value": {"path": "/name"}}},
    "message": "Name is required"}
 ]},
{"id": "email_field", "component": "TextField",
 "label": "Email", "value": {"path": "/email"},
 "_bindings": {"value": "/email"},
 "checks": [
   {"condition": {"call": "required", "args": {"value": {"path": "/email"}}},
    "message": "Email is required"},
   {"condition": {"call": "email", "args": {"value": {"path": "/email"}}},
    "message": "Must be a valid email address"}
 ]},
{"id": "submit_btn", "component": "Button",
 "label": "Submit",
 "checks": [
   {"condition": {"call": "and", "args": {"values": [
     {"call": "required", "args": {"value": {"path": "/name"}}},
     {"call": "email", "args": {"value": {"path": "/email"}}}
   ]}},
    "message": "Complete all required fields"}
 ],
 "action": {"event": {"name": "formSubmit", "context": {"formId": "contact"}}}}
```

**Files:**
- `cockpit/chat/a2ui/python/src/graph.py`

## 8. Documentation

### Updated Pages

- **`apps/website/content/docs/chat/a2ui/overview.mdx`** — Add "Validation" section:
  - v0.9 `CheckRule` shape with `condition: DynamicBoolean`
  - Built-in validation functions (required, regex, length, numeric, email)
  - Composite conditions with and/or/not
  - Inline error display on input components
  - Button auto-disable behavior
  - `validationResult` prop contract for custom catalog components
  - Explicit v0.9 spec alignment callout

- **`apps/website/content/docs/chat/a2ui/overview.mdx`** — Add "Functions" section:
  - All 14 basic catalog functions with signatures
  - Grouped by category: validation, formatting, logic, navigation
  - Reference to v0.9 `basic_catalog.json`

- **Catalog component docs** — Document `validationResult` prop contract for custom component authors

## Spec Alignment

### v0.9 `common_types.json`
- `CheckRule` = `{ condition: DynamicBoolean, message: string }` — our `A2uiCheckRule` matches exactly
- `Checkable` = `{ checks?: CheckRule[] }` — our `A2uiComponent.checks` matches
- `FunctionCall` = `{ call: string, args: Record<string, unknown>, returnType?: string }` — our `A2uiFunctionCall` matches

### v0.9 `basic_catalog.json`
- All 14 functions implemented: `required`, `regex`, `length`, `numeric`, `email`, `formatString`, `formatNumber`, `formatCurrency`, `formatDate`, `pluralize`, `and`, `or`, `not`, `openUrl`
- `Checkable` components: `TextField`, `CheckBox`, `ChoicePicker`, `Slider`, `DateTimeInput`, `Button`

### Renderer contract
- Input components validate continuously (via signal reactivity in `surfaceToSpec`)
- Button auto-disables when checks fail
- Inline error display via shared `A2uiValidationErrorsComponent`
- `validationResult` prop is the boundary — catalog components (built-in and custom) never interact with the evaluation engine

## Future Considerations (Out of Scope)

- **Async validation** — Remote validation via server round-trip. Current design is synchronous/client-side only.
- **Custom function registration** — Consumer-defined functions beyond the 14 built-ins. Requires catalog extension mechanism.
- **Touched/dirty state** — Only show errors after user has interacted with a field. Current design shows errors immediately on any data model state.
- **`formatString` in arbitrary props** — Currently `formatString` is a named function. The `${...}` interpolation syntax in arbitrary string props is handled by `resolveDynamic`'s template interpolation, not the `formatString` function.
