# A2UI v0.9 Phase 2 — Design Spec

**Date:** 2026-04-09
**Status:** Draft

## Goal

Make A2UI surfaces interactive: actions on buttons dispatch events to the agent, input components write back to the data model, collection templates expand over arrays, and registered functions resolve in data bindings.

## Scope

### In Scope

1. **Action system** — Server event dispatch from buttons, local function execution (`openUrl`)
2. **Two-way data binding** — TextField, CheckBox, ChoicePicker update the surface data model on user input
3. **Template expansion** — `children: { path, componentId }` expands over data model arrays with scoped bindings
4. **Function execution** — Implement `formatString`, `formatNumber`, `formatCurrency`, `formatDate`, `pluralize`, `openUrl`, `and`, `or`, `not` in the resolve layer
5. **Validation** — `checks` array on inputs/buttons, disable button when checks fail

### Out of Scope (Phase 3)

- Tabs, Modal, Video, AudioPlayer, DateTimeInput, Slider components
- Custom catalog definitions (`inlineCatalogs`)
- Multi-agent theme attribution
- `sendDataModel` metadata in A2A transport
- Error recovery for malformed A2UI messages

---

## Part 1: Action System

### Server Actions

When a button has `action.event`, clicking it emits an event that the agent can receive. The `A2uiSurfaceComponent` accepts an `actionHandler` output:

```ts
readonly actionDispatched = output<A2uiActionEvent>();

interface A2uiActionEvent {
  name: string;
  surfaceId: string;
  sourceComponentId: string;
  timestamp: string;
  context?: Record<string, unknown>;
}
```

The ChatComponent wires this to the agent ref's submit mechanism, sending the event as a message payload. The exact transport binding depends on how the LangGraph backend handles A2UI actions (likely as a tool call response or interrupt response).

### Local Actions

When a button has `action.functionCall`, clicking it executes a registered client-side function. For Phase 2, `openUrl` is the only local action — it calls `window.open()`.

### Button Component Changes

Replace the read-only button with an interactive one:

```ts
@Component({
  template: `
    <button (click)="handleClick()" [disabled]="disabled()">
      {{ label() }}
    </button>
  `,
})
export class A2uiButtonComponent {
  readonly action = input<A2uiAction | undefined>(undefined);
  readonly emit = input.required<(event: string) => void>();
  // ...
  handleClick() {
    const act = this.action();
    if (!act) return;
    if ('event' in act) {
      this.emit()(`a2ui:action:${act.event.name}`);
    } else if ('functionCall' in act) {
      executeLocalAction(act.functionCall);
    }
  }
}
```

---

## Part 2: Two-Way Data Binding

Input components (TextField, CheckBox, ChoicePicker) establish a read/write contract with the data model:

- **Read**: Component displays value from its bound data path
- **Write**: User input immediately updates the local surface data model

### Binding Resolution

When `surfaceToSpec` encounters a prop that's a `{ path }` reference on an input component, it:
1. Resolves the current value from the data model (for display)
2. Passes the binding path as a `bindings` prop so the component can write back

### Data Model Update Flow

```
User types in TextField
  → Component emits value change
  → SurfaceStore.updateDataModel({ surfaceId, path, value })
  → Surface signal updates
  → All components re-resolve their bindings
```

The `A2uiSurfaceComponent` needs a reference to the store to enable write-back:

```ts
readonly store = input<A2uiSurfaceStore | undefined>(undefined);
```

### Input Component Changes

TextField becomes:
```ts
<input [value]="value()" (input)="onInput($event)" />

onInput(event: Event) {
  const val = (event.target as HTMLInputElement).value;
  this.bindings()?.['value'] && this.updateDataModel(this.bindings()['value'], val);
}
```

CheckBox becomes:
```ts
<input type="checkbox" [checked]="checked()" (change)="onChange($event)" />
```

---

## Part 3: Template Expansion (Collections)

When `children` is `{ path: "/employees", componentId: "emp_card" }`:

1. Read the array at `/employees` from the data model
2. For each item at index N, create a scope: `{ basePath: '/employees/N', item }`
3. Render the template component (`emp_card`) once per item
4. Relative paths inside the template resolve against the item's scope

### Implementation in surfaceToSpec

The `surfaceToSpec` function currently skips template children. Add:

```ts
if (typeof comp.children === 'object' && !Array.isArray(comp.children)) {
  const template = comp.children as A2uiChildTemplate;
  const arr = getByPointer(surface.dataModel, template.path);
  if (Array.isArray(arr)) {
    children = arr.map((_, i) => `${template.componentId}__${i}`);
    // Generate cloned components for each item with scoped bindings
    for (let i = 0; i < arr.length; i++) {
      const scope = { basePath: `${template.path}/${i}`, item: arr[i] };
      const templateComp = surface.components.get(template.componentId);
      if (templateComp) {
        // Clone and resolve with scope
        elements[`${template.componentId}__${i}`] = resolveComponentWithScope(templateComp, surface.dataModel, scope);
      }
    }
  }
}
```

---

## Part 4: Function Execution

Replace the `[functionName]` stub in `resolveDynamic` with actual implementations.

### Registered Functions

| Function | Args | Returns |
|----------|------|---------|
| `formatString` | `template: string` | Interpolated string |
| `formatNumber` | `value: number, grouping?: boolean, precision?: number` | Formatted number string |
| `formatCurrency` | `value: number, currency: string, locale?: string` | Currency string |
| `formatDate` | `value: string, format: string` | Formatted date string |
| `pluralize` | `count: number, singular: string, plural: string` | Chosen form |
| `openUrl` | `url: string` | void (side effect) |
| `and` | `...conditions: boolean[]` | boolean |
| `or` | `...conditions: boolean[]` | boolean |
| `not` | `value: boolean` | boolean |

### Implementation

```ts
const FUNCTIONS: Record<string, (args: Record<string, unknown>, model: Record<string, unknown>) => unknown> = {
  formatString: (args) => interpolateTemplate(String(args['template'] ?? ''), model),
  formatNumber: (args) => {
    const n = Number(args['value']);
    const precision = Number(args['precision'] ?? 0);
    return args['grouping'] ? n.toLocaleString(undefined, { minimumFractionDigits: precision }) : n.toFixed(precision);
  },
  formatCurrency: (args) => Number(args['value']).toLocaleString(String(args['locale'] ?? 'en-US'), { style: 'currency', currency: String(args['currency']) }),
  formatDate: (args) => new Date(String(args['value'])).toLocaleDateString(),
  pluralize: (args) => Number(args['count']) === 1 ? String(args['singular']) : String(args['plural']),
  openUrl: (args) => { if (typeof window !== 'undefined') window.open(String(args['url']), '_blank'); },
  and: (args) => Object.values(args).every(Boolean),
  or: (args) => Object.values(args).some(Boolean),
  not: (args) => !args['value'],
};
```

In `resolveDynamic`, replace the stub:

```ts
if (isFunctionCall(value)) {
  const fn = FUNCTIONS[(value as A2uiFunctionCall).call];
  if (!fn) return `[${(value as A2uiFunctionCall).call}]`;
  const resolvedArgs = resolveArgs((value as A2uiFunctionCall).args, model, scope);
  return fn(resolvedArgs, model);
}
```

---

## Part 5: Validation

### Input Validation

Input components with `checks` run validation on value changes:

```ts
interface A2uiValidationResult {
  valid: boolean;
  errors: string[];
}

function validateChecks(checks: A2uiCheck[], model: Record<string, unknown>): A2uiValidationResult;
```

### Button Validation

Buttons with `checks` are disabled when any check fails. The button resolves its checks against the current data model and disables itself accordingly.

### Validation Functions

Implement `required`, `regex`, `length`, `numeric`, `email` as check executors:

```ts
const VALIDATORS: Record<string, (args: Record<string, unknown>) => boolean> = {
  required: (args) => args['value'] != null && String(args['value']).trim() !== '',
  regex: (args) => new RegExp(String(args['pattern'])).test(String(args['value'])),
  length: (args) => { const len = String(args['value'] ?? '').length; return len >= Number(args['min'] ?? 0) && len <= Number(args['max'] ?? Infinity); },
  numeric: (args) => { const n = Number(args['value']); return n >= Number(args['min'] ?? -Infinity) && n <= Number(args['max'] ?? Infinity); },
  email: (args) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(args['value'])),
};
```

---

## Deliverables

| # | Deliverable | Package | Description |
|---|------------|---------|-------------|
| 1 | Function execution | `@cacheplane/a2ui` | Replace stubs with 10 registered functions |
| 2 | Validation | `@cacheplane/a2ui` | 5 validation functions + check executor |
| 3 | Template expansion | `@cacheplane/chat` | Collection children with scoped bindings in surfaceToSpec |
| 4 | Two-way data binding | `@cacheplane/chat` | Input components write to surface data model |
| 5 | Action system | `@cacheplane/chat` | Button event dispatch + openUrl local action |
