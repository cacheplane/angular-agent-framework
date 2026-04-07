# Generative UI: Views System Design

**Date:** 2026-04-07
**Status:** Draft
**Scope:** `@cacheplane/render` views API + compositional rendering + `@cacheplane/chat` inline integration

---

## Overview

A system for exposing Angular components to the agent as **views** — renderable UI that appears inline in the chat. The agent produces JSON specs (in tool results, state, or message metadata) that the chat library renders using the existing `@cacheplane/render` pipeline. Developers register views with a functional API, compose them via object spread, and the chat handles detection and rendering automatically.

### Design Principles

1. **Views are what the user sees** — not implementation details (components), not small widgets. A view is a visual representation of data, inspired by Apple's SwiftUI View protocol.
2. **Backend controls the UI** — the Python graph produces the full nested spec. The frontend is a pure renderer.
3. **Data down, actions up** — props flow from spec → view. User interactions flow up through `signalStateStore()`.
4. **Composition via spread** — no special merge functions. JavaScript object spread handles composition, override, and extension.

---

## Deliverable 1: `views()` Functional API

### Public API

```typescript
// @cacheplane/render

// Create a view registry
function views(map: Record<string, Type<unknown>>): ViewRegistry;

// Add views without overwriting existing entries
function withViews(base: ViewRegistry, additions: Record<string, Type<unknown>>): ViewRegistry;

// Remove views by name
function withoutViews(base: ViewRegistry, ...names: string[]): ViewRegistry;

// Provide views globally via Angular DI
function provideViews(registry: ViewRegistry): EnvironmentProviders;
```

### ViewRegistry Type

```typescript
// Opaque type wrapping a frozen Record<string, Type<unknown>>
// Supports iteration, lookup, and spread
interface ViewRegistry {
  readonly [name: string]: Type<unknown>;
}
```

`ViewRegistry` is a plain frozen object. `views()` creates one, `withViews()` and `withoutViews()` return new ones. All are immutable.

### Implementation

```typescript
export function views(map: Record<string, Type<unknown>>): ViewRegistry {
  return Object.freeze({ ...map }) as ViewRegistry;
}

export function withViews(
  base: ViewRegistry,
  additions: Record<string, Type<unknown>>,
): ViewRegistry {
  // Additions go first, base overwrites → existing keys preserved
  return Object.freeze({ ...additions, ...base }) as ViewRegistry;
}

export function withoutViews(
  base: ViewRegistry,
  ...names: string[]
): ViewRegistry {
  const result = { ...base };
  for (const name of names) delete result[name];
  return Object.freeze(result) as ViewRegistry;
}

const VIEW_REGISTRY = new InjectionToken<ViewRegistry>('VIEW_REGISTRY');

export function provideViews(registry: ViewRegistry): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: VIEW_REGISTRY, useValue: registry },
  ]);
}
```

### Relationship to `defineAngularRegistry()`

`views()` is the high-level API. Under the hood, when the chat library needs to render a spec, it converts the `ViewRegistry` to an `AngularRegistry` (the format `RenderSpecComponent` expects). `defineAngularRegistry()` remains the low-level API for direct `@cacheplane/render` usage.

### Usage Examples

```typescript
// Define
const agentViews = views({
  'plan-checklist': PlanChecklistComponent,
  'file-preview': FilePreviewComponent,
  'code-output': CodeOutputComponent,
  'choice-card': ChoiceCardComponent,
});

// Compose via spread (last key wins = override)
const all = views({ ...agentViews, ...thirdPartyViews });

// Add without overwriting
const extended = withViews(agentViews, { 'chart': ChartComponent });

// Remove
const restricted = withoutViews(agentViews, 'file-preview');

// Provide globally
providers: [provideViews(agentViews)]

// Provide per-instance
<chat [ref]="stream" [views]="agentViews" />

// Route-level scoping
{ path: 'planning', providers: [provideViews(planningViews)] }
```

---

## Deliverable 2: Compositional Rendering

### Spec Format

The agent produces specs conforming to `@json-render/core`'s `Spec` type — a flat map of elements with a root key. Each element has a `type` (matched against the view registry), `props`, and optional `children`.

```json
{
  "root": "plan",
  "elements": {
    "plan": {
      "type": "plan-checklist",
      "props": { "title": "Birthday Party Plan" },
      "children": ["step-0", "step-1", "step-2"]
    },
    "step-0": {
      "type": "checkbox-row",
      "props": {
        "label": "Choose a venue",
        "checked": { "$state": "/steps/0/done" }
      }
    },
    "step-1": {
      "type": "checkbox-row",
      "props": {
        "label": "Send invitations",
        "checked": { "$state": "/steps/1/done" }
      }
    },
    "step-2": {
      "type": "checkbox-row",
      "props": {
        "label": "Order cake",
        "checked": { "$state": "/steps/2/done" }
      }
    }
  }
}
```

### Rendering Pipeline

1. Agent returns spec in tool result, state, or message metadata
2. Chat detects spec (see Deliverable 3)
3. Chat passes spec to `<render-spec>` with the view registry + state store
4. `RenderSpecComponent` resolves root element → looks up `plan-checklist` in registry
5. `RenderElementComponent` renders the component via `NgComponentOutlet`
6. Recurses into `children` → renders each `checkbox-row`
7. Props with `$state` expressions bind to `signalStateStore()` for reactivity

### View Component Contract

Each view component receives props as Angular `input()` signals. The component doesn't know or care that it's being rendered by json-render — it's a normal Angular standalone component.

```typescript
@Component({
  selector: 'plan-checklist',
  standalone: true,
  template: `
    <div class="border rounded-xl p-4">
      <h3 class="font-semibold">{{ title() }}</h3>
      <ng-content />  <!-- children rendered here by json-render -->
    </div>
  `,
})
export class PlanChecklistComponent {
  readonly title = input<string>('');
}
```

Children are projected via `<ng-content>` — json-render's `RenderElementComponent` handles the recursion and content projection.

### Nested Composition

Views compose by nesting in the spec. The registry is flat (name → component), but the rendered output is a tree:

```
plan-checklist
├── checkbox-row ("Choose a venue")
├── checkbox-row ("Send invitations")
└── checkbox-row ("Order cake")
```

A `file-preview` view could contain `code-block` and `metadata-row` children:

```
file-preview
├── metadata-row ("path: /config.json")
├── metadata-row ("size: 2.4 KB")
└── code-block (file contents)
```

The backend defines the tree structure. The frontend renders it faithfully.

---

## Deliverable 3: Chat Integration

### How the Chat Detects Specs

The `<chat>` composition checks three locations for UI specs:

1. **Tool call results** — if a tool result message contains a `ui` field with a valid spec
2. **Graph state** — if `stream.value()` contains a `ui` field
3. **Message metadata** — if an AI message contains a `ui` field

Detection priority: tool result > message metadata > state. The chat renders the first spec found per message.

### Chat Component Changes

```typescript
// chat.component.ts — new inputs
readonly views = input<ViewRegistry | undefined>(undefined);
readonly store = input<StateStore | undefined>(undefined);

// Inject DI-provided registry as fallback
private readonly diViews = inject(VIEW_REGISTRY, { optional: true });

// Resolved registry: input takes precedence over DI
private readonly resolvedViews = computed(() =>
  this.views() ?? this.diViews ?? undefined
);
```

### Template Integration

In the `ChatMessagesComponent` template, after rendering the message text, check for a UI spec:

```html
@for (message of messages(); track $index) {
  <!-- Render message text (human/ai/tool as before) -->
  @let template = findTemplate(getMessageType(message));
  @if (template) {
    <ng-container [ngTemplateOutlet]="template.templateRef" ... />
  }

  <!-- Render inline generative UI if spec present -->
  @if (resolvedViews() && getUiSpec(message); as spec) {
    <div class="ml-10 mt-2">
      <render-spec
        [spec]="spec"
        [registry]="toRenderRegistry(resolvedViews()!)"
        [store]="store()"
      />
    </div>
  }
}
```

### Spec Extraction

```typescript
function getUiSpec(message: BaseMessage): Spec | null {
  const msg = message as Record<string, unknown>;

  // Check tool result ui field
  if (msg['ui'] && isValidSpec(msg['ui'])) {
    return msg['ui'] as Spec;
  }

  // Check message additional_kwargs
  const kwargs = msg['additional_kwargs'] as Record<string, unknown> | undefined;
  if (kwargs?.['ui'] && isValidSpec(kwargs['ui'])) {
    return kwargs['ui'] as Spec;
  }

  return null;
}

function isValidSpec(value: unknown): boolean {
  return typeof value === 'object'
    && value !== null
    && 'root' in value
    && 'elements' in value;
}
```

---

## Deliverable 4: State Store Integration

### Two-Way Interactivity

When views need interactivity (checkboxes, buttons, form inputs), they read/write through `signalStateStore()`.

**Flow:**

1. Spec includes state-bound props: `{ "$state": "/steps/0/done" }`
2. json-render resolves the binding → creates a signal from the store path
3. Component receives the value as an input (reactive)
4. User interacts → component calls `store.set('/steps/0/done', true)`
5. Store updates → signal fires → all bound views re-render
6. Consumer observes changes via the store

### Consumer Owns the Store

The consumer creates and owns the `signalStateStore()`, passing it to `<chat>`:

```typescript
@Component({
  template: `<chat [ref]="stream" [views]="ui" [store]="uiStore" />`,
})
export class PlanningComponent {
  stream = agent({ apiUrl: '/api', assistantId: 'planning' });
  ui = views({ 'plan-checklist': PlanChecklist, 'checkbox-row': CheckboxRow });
  uiStore = signalStateStore({});

  constructor() {
    // Observe user interactions with views
    effect(() => {
      const state = this.uiStore.getSnapshot();
      // React to checkbox toggles, button clicks, form submissions
    });
  }
}
```

### Event Handlers

For actions beyond state updates (e.g., "submit form", "approve action"), views can use json-render's event system:

```json
{
  "type": "approval-form",
  "props": { "email": { "$state": "/draft" } },
  "on": {
    "approve": { "action": "submitApproval" },
    "cancel": { "action": "cancelDraft" }
  }
}
```

The chat component exposes an `(action)` output for these events:

```typescript
<chat
  [ref]="stream"
  [views]="ui"
  [store]="uiStore"
  (action)="onViewAction($event)"
/>
```

Where `$event` is `{ name: string; params: Record<string, unknown> }`.

---

## Per-Example Application

### How each cockpit example benefits:

| Example | Current | With Generative UI |
|---------|---------|-------------------|
| **Streaming** | Plain text chat | No change needed (no tool calls) |
| **Persistence** | Custom thread sidebar | Thread list could be a view in the sidebar slot |
| **Interrupts** | Static interrupt panel | `approval-form` view with editable fields + approve/cancel |
| **Memory** | Custom facts sidebar | `fact-list` view rendered from state, reactive updates |
| **Durable Execution** | Custom pipeline sidebar | `step-pipeline` view with animated progress |
| **Subgraphs** | "No subagents active" text | `subagent-card` views showing nested message streams |
| **Time Travel** | Custom timeline | `checkpoint-timeline` view with replay/fork actions |
| **Planning** | Plain text plan | `plan-checklist` with interactive checkboxes |
| **Filesystem** | Custom file ops log | `file-preview` view with syntax-highlighted content |
| **Skills** | Custom skill log | `tool-result-card` view per skill invocation |
| **Sandboxes** | Custom execution log | `code-execution` view with stdout/stderr panels |
| **DA-Subagents** | Custom delegation tracker | `delegation-card` views with live status |
| **DA-Memory** | Custom facts sidebar | Same as LG memory — `fact-list` view |

### Priority for implementation:

1. **Planning** — interactive checklist (highest demo value)
2. **Skills** — tool result cards (validates the tool call → view pipeline)
3. **Interrupts** — approval form (shows interactivity + state store)
4. **Filesystem** — file preview cards (validates nested composition)

---

## Files Changed

### New files
- `libs/render/src/lib/views.ts` — `views()`, `withViews()`, `withoutViews()`, `provideViews()`, `VIEW_REGISTRY` token
- `libs/render/src/lib/views.spec.ts` — tests for view registry operations

### Modified files
- `libs/render/src/public-api.ts` — export new views API
- `libs/chat/src/lib/compositions/chat/chat.component.ts` — add `[views]`, `[store]`, `(action)` inputs/outputs, detect specs, render inline
- `libs/chat/src/lib/primitives/chat-messages/chat-messages.component.ts` — detect UI specs in messages, render via `<render-spec>`
- `libs/chat/src/lib/provide-chat.ts` — add `views` to `ChatConfig`
- `libs/chat/src/public-api.ts` — re-export views API from render

### Unchanged
- `@json-render/core` — no changes needed, existing spec format supports everything
- `libs/render/src/lib/` — existing `RenderSpecComponent`, `RenderElementComponent`, `signalStateStore()` used as-is

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| API naming | `views()` not `components()` | "View" = what the user sees (SwiftUI precedent). "Component" collides with Angular's `@Component`. |
| Composition | Object spread | No special merge functions. JavaScript developers already know spread. Last key wins for override. |
| Spec source | Backend produces full spec | Agent controls the UI. Frontend is a pure renderer. |
| State management | Consumer owns `signalStateStore()` | Most flexible. Consumer observes changes and decides actions. |
| Registry level | High-level `views()` wraps low-level `defineAngularRegistry()` | Clean abstraction. Power users can still use the low-level API. |
| Detection | `ui` field in tool results / state / message metadata | Convention-based. No new protocol. Backend just includes `ui` in its output. |
| Strip "Angular" from API | Yes | The whole library is Angular. Saying it is redundant. |
