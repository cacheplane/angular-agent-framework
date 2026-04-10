# A2UI Phase 3 Design Spec

## Overview

A2UI Phase 3 delivers three capabilities: 6 new components expanding the catalog to 18, a generalized event system built into the render lib, and custom catalog support through the existing ViewRegistry composition API. The event system is the foundational change — it lives in `@cacheplane/render` so both json-render specs and A2UI surfaces share one event model.

## 1. Render-Lib Event System

### Event Types

A new `RenderEvent` union type in `@cacheplane/render`:

```typescript
type RenderEvent =
  | RenderHandlerEvent
  | RenderStateChangeEvent
  | RenderLifecycleEvent;

interface RenderHandlerEvent {
  type: 'handler';
  action: string;
  params: Record<string, unknown>;
  result?: unknown;
}

interface RenderStateChangeEvent {
  type: 'stateChange';
  path: string;
  value: unknown;
  snapshot: Record<string, unknown>;
}

interface RenderLifecycleEvent {
  type: 'lifecycle';
  event: 'mounted' | 'destroyed';
  scope: 'spec' | 'element';
  elementKey?: string;
  elementType?: string;
}
```

### RenderSpecComponent Changes

- New `events` output emitting `RenderEvent`.
- Existing `handlers` input unchanged — local handlers execute immediately, then a `RenderHandlerEvent` is emitted on `events`.
- `StateStore` subscription: on every `set()`/`update()`, a `RenderStateChangeEvent` fires with path, new value, and full snapshot.
- Spec-level lifecycle: `mounted` on `ngOnInit`, `destroyed` on `ngOnDestroy`.
- Element-level lifecycle: only for elements with `lifecycle: true` in the spec. Opt-in to avoid noise.

### Public API Additions

New exports from `@cacheplane/render`:

```typescript
export type {
  RenderEvent,
  RenderHandlerEvent,
  RenderStateChangeEvent,
  RenderLifecycleEvent,
};
```

## 2. New A2UI Components (6)

All follow the existing pattern: standalone Angular component in `libs/chat/src/lib/a2ui/catalog/`. Registered in `a2uiBasicCatalog()`, bringing the total to 18.

### Tabs

```typescript
props: {
  tabs: { label: string; childKeys: string[] }[];
  selected?: number;                         // default 0
  _bindings?: { selected: string };          // two-way bind selected index
}
```

Tab bar with click handlers. Content panel renders `childKeys` of active tab via `<render-element>`. Writes selected index to StateStore on tab change.

### Modal

```typescript
props: {
  title?: string;
  open: boolean;
  childKeys: string[];
  dismissible?: boolean;                     // default true
  _bindings?: { open: string };
}
```

Overlay dialog with backdrop. Renders children in dialog body. Writes open state to StateStore on open/close. Backdrop click closes when dismissible.

### Video

```typescript
props: {
  url: string;
  poster?: string;
  autoplay?: boolean;                        // default false
  controls?: boolean;                        // default true
}
```

HTML5 `<video>` wrapper. Display only, no bindings.

### AudioPlayer

```typescript
props: {
  url: string;
  autoplay?: boolean;                        // default false
  controls?: boolean;                        // default true
}
```

HTML5 `<audio>` wrapper. Display only, no bindings.

### DateTimeInput

```typescript
props: {
  label?: string;
  value?: string;                            // ISO string
  type?: 'date' | 'time' | 'datetime-local'; // default 'date'
  min?: string;
  max?: string;
  _bindings?: { value: string };
}
```

Native date/time `<input>`. Writes value to StateStore on change.

### Slider

```typescript
props: {
  label?: string;
  value?: number;                            // default: min
  min: number;
  max: number;
  step?: number;                             // default 1
  _bindings?: { value: string };
}
```

`<input type="range">` with value label. Writes value to StateStore on change.

## 3. A2UI Action → Spec Event Binding Bridge

Today `surfaceToSpec()` passes `action` as a raw prop. Phase 3 wires A2UI actions into the render-lib's `on` binding system.

### surfaceToSpec() Mapping

A2UI event actions map to spec `on` bindings:

```typescript
// A2UI component with event action
{
  id: 'submit_btn',
  component: 'Button',
  label: 'Submit',
  action: { event: { name: 'formSubmit', context: { formId: 'signup' } } }
}

// Produces UIElement with on binding
{
  type: 'Button',
  props: { label: 'Submit' },
  on: {
    click: {
      action: 'a2ui:event',
      params: { surfaceId: 'sf1', name: 'formSubmit', context: { formId: 'signup' } }
    }
  }
}
```

A2UI local actions (function calls) map similarly:

```typescript
// A2UI local action
{ action: { functionCall: { call: 'openUrl', args: { url: 'https://...' } } } }

// Produces
{
  on: {
    click: {
      action: 'a2ui:localAction',
      params: { call: 'openUrl', args: { url: 'https://...' } }
    }
  }
}
```

### Default A2UI Handlers

`A2uiSurfaceComponent` registers two handlers in the `RenderContext`:

- `a2ui:event` — emits upward for consumer routing to agent.
- `a2ui:localAction` — executes locally via the function registry (e.g., `openUrl`).

Both fire through the render-lib event system, so the consumer sees them as `RenderHandlerEvent` on the `events` output.

### Data Model → StateStore Bridge

- `surfaceToSpec()` initializes the spec's `state` from `surface.dataModel`.
- Two-way `_bindings` map to `$bindState` expressions in resolved props.
- When a bound input changes, it writes to `StateStore` (existing render-lib mechanism).
- `StateStore` subscription emits `RenderStateChangeEvent` — consumer sees data model mutations as state changes.
- `A2uiSurfaceStore` remains source of truth for incoming agent messages; it syncs into `StateStore` on each `updateDataModel` message.

This eliminates the custom `a2ui:datamodel` event emission pattern in favor of the render-lib's state change events.

## 4. Custom Catalogs

No new API. Consumers compose catalogs using existing `views`/`withViews`/`withoutViews` from `@cacheplane/render`.

### ChatComponent Registry

The existing `views` input is the single source of truth for all generative UI:

```typescript
readonly views = input<ViewRegistry | undefined>(undefined);
```

- **No views provided:** No generative UI rendering (graceful no-op). No implicit fallback to A2UI.
- **Consumer wants A2UI:** `<chat [views]="a2uiBasicCatalog()" />`
- **Consumer wants A2UI + custom:** `<chat [views]="withViews(a2uiBasicCatalog(), { Chart: MyChart })" />`
- **Consumer wants only custom, no A2UI:** `<chat [views]="views({ Chart: MyChart })" />`

`a2uiBasicCatalog()` remains a convenience export — consumers compose with it explicitly when they want A2UI support.

The `catalogId` field on `A2uiCreateSurface` is deferred — multi-catalog routing is a follow-up concern.

## 5. ChatComponent Event Output

### ChatRenderEvent

```typescript
interface ChatRenderEvent {
  messageIndex: number;
  surfaceId?: string;
  event: RenderEvent;
}
```

### Output

```typescript
readonly renderEvent = output<ChatRenderEvent>();
```

Both `<chat-generative-ui>` and `<a2ui-surface>` bind their `render-spec` `events` output. `ChatComponent` wraps each with the message index and optional surface ID, then emits on `renderEvent`.

### Consumer Usage

```typescript
<chat
  [ref]="agentRef"
  [views]="catalog"
  (renderEvent)="onRenderEvent($event)"
/>

onRenderEvent(e: ChatRenderEvent) {
  if (e.event.type === 'handler' && e.event.action === 'a2ui:event') {
    this.agentRef.sendMessage({ type: 'a2ui_event', ...e.event.params });
  }
  if (e.event.type === 'stateChange' && e.surfaceId) {
    // Data model changed — route back if needed
  }
}
```

## 6. Documentation Updates

### New Pages

- **`render/events.mdx`** — RenderEvent types, handler + event interaction, lifecycle opt-in, StateStore change events, usage examples.
- **`guides/custom-catalogs.mdx`** — Composing catalogs with `views`/`withViews`/`withoutViews`, registering custom components, using with `ChatComponent` for both json-render and A2UI paths.

### Updated Pages

- **`chat/a2ui/catalog.mdx`** — Add 6 new components, update count to 18, update summary table.
- **`chat/a2ui/overview.mdx`** — Action → event binding bridge, events flowing back through render-lib.
- **`chat/a2ui/surface-store.mdx`** — StateStore bridge documentation.
- **`chat/a2ui/surface-component.mdx`** — Default handlers (`a2ui:event`, `a2ui:localAction`), action-to-binding mapping.
- **Chat component docs** — `renderEvent` output, `ChatRenderEvent` type, `views` as single registry, consumer wiring examples.

## Future Considerations (Out of Scope)

- **Granular event outputs** — Filtered outputs by event type, per-surface event streams, or declarative event routing in the spec.
- **`catalogId` routing** — Multi-catalog support where `createSurface` selects a catalog by ID.
- **A2UI Phase 4 components** — Additional components beyond the 18 in this phase.
- **Remote function calls** — Agent-defined functions that execute server-side.
- **`sendDataModel` transport integration** — Built-in StreamManager integration for sending data model state back to agents.
