# A2UI v0.9 Phase 1 — Design Spec

**Date:** 2026-04-09
**Status:** Draft

## Goal

Implement A2UI v0.9 protocol support for rendering agent-driven UI surfaces in Angular. Phase 1 covers: JSONL message parsing, surface state management, a default component catalog matching the v0.9 basic catalog, and an Angular renderer that resolves data bindings and template iteration. No client-to-server actions or validation (Phase 2).

## Architecture Overview

```
A2UI JSONL stream (one JSON object per line)
  → A2uiMessageParser (parse + validate envelope messages)
  → A2uiSurfaceStore (maintain surfaces, components, data model)
    ├── Component adjacency list → tree resolution
    ├── Data model with JSON Pointer get/set
    └── Template expansion for collections
  → A2uiSurfaceComponent (Angular renderer)
    ├── Resolves DynamicString/Number/Boolean bindings
    ├── Maps A2UI component names → Angular components via catalog
    └── Recursively renders component tree
```

## Part 1: A2UI Message Parser

### Purpose

A standalone, framework-agnostic TypeScript library that parses A2UI v0.9 JSONL messages into typed envelope objects. Lives in a new `@cacheplane/a2ui` library at `libs/a2ui/`.

### Message Types

```ts
interface A2uiCreateSurface {
  type: 'createSurface';
  surfaceId: string;
  catalogId: string;
  theme?: A2uiTheme;
  sendDataModel?: boolean;
}

interface A2uiUpdateComponents {
  type: 'updateComponents';
  surfaceId: string;
  components: A2uiComponent[];
}

interface A2uiUpdateDataModel {
  type: 'updateDataModel';
  surfaceId: string;
  path?: string;       // JSON Pointer, defaults to '/'
  value?: unknown;     // omitting removes the key
}

interface A2uiDeleteSurface {
  type: 'deleteSurface';
  surfaceId: string;
}

type A2uiMessage =
  | A2uiCreateSurface
  | A2uiUpdateComponents
  | A2uiUpdateDataModel
  | A2uiDeleteSurface;
```

### Component Type

```ts
interface A2uiComponent {
  id: string;
  component: string;            // 'Text', 'Button', 'Column', etc.
  children?: A2uiChildList;     // static array or template
  action?: A2uiAction;          // Phase 2
  checks?: A2uiCheck[];         // Phase 2
  [key: string]: unknown;       // component-specific props (DynamicString, etc.)
}

/** Static children or collection template. */
type A2uiChildList =
  | string[]                              // static list of component IDs
  | { path: string; componentId: string }; // template over collection
```

### Parser API

```ts
interface A2uiMessageParser {
  /** Feed a chunk of JSONL text. Returns parsed messages. */
  push(chunk: string): A2uiMessage[];
}

function createA2uiMessageParser(): A2uiMessageParser;
```

The parser accumulates text, splits on newlines, parses each complete line as JSON, and extracts the envelope type from the top-level key (`createSurface`, `updateComponents`, etc.).

### Library Boundary

- Package: `@cacheplane/a2ui`
- Nx lib at `libs/a2ui/`
- Zero dependencies, pure TypeScript
- No Angular coupling — the Angular integration lives in `libs/chat/`

---

## Part 2: A2UI Surface Store

### Purpose

An Angular signal-based store that maintains the state of all active A2UI surfaces. Processes parsed `A2uiMessage` objects and exposes reactive signals for rendering.

Lives in `libs/chat/src/lib/streaming/` alongside the existing `ParseTreeStore` and `ContentClassifier`.

### Interface

```ts
interface A2uiSurface {
  surfaceId: string;
  catalogId: string;
  theme?: A2uiTheme;
  /** Flat component map: id → component */
  components: Map<string, A2uiComponent>;
  /** Data model (plain JS object, navigated via JSON Pointer) */
  dataModel: Record<string, unknown>;
}

interface A2uiSurfaceStore {
  /** Process a parsed A2UI message. */
  apply(message: A2uiMessage): void;

  /** All active surfaces. */
  readonly surfaces: Signal<Map<string, A2uiSurface>>;

  /** Get a single surface by ID. */
  surface(surfaceId: string): Signal<A2uiSurface | undefined>;
}

function createA2uiSurfaceStore(): A2uiSurfaceStore;
```

### Message Handling

- **createSurface** — Creates a new `A2uiSurface` entry with empty components and dataModel.
- **updateComponents** — Merges components into the surface's component map by ID. Existing components with the same ID are replaced.
- **updateDataModel** — Sets the value at the given JSON Pointer path in the surface's data model. If `path` is omitted or `/`, replaces the entire model. If `value` is omitted, deletes the key.
- **deleteSurface** — Removes the surface from the store.

### Data Model Access

```ts
function getByPointer(model: Record<string, unknown>, pointer: string): unknown;
function setByPointer(model: Record<string, unknown>, pointer: string, value: unknown): Record<string, unknown>;
```

Uses RFC 6901 JSON Pointer syntax. `setByPointer` returns a new object (immutable update) for signal change detection.

---

## Part 3: Default Component Catalog

### Purpose

Ships Angular components matching the A2UI v0.9 basic catalog. Uses the same `views()` / `ViewRegistry` pattern as json-render so consumers can override or extend.

Lives in `libs/chat/src/lib/a2ui/catalog/`.

### Components (Phase 1 — display + layout)

| A2UI Type | Angular Component | Description |
|-----------|------------------|-------------|
| `Text` | `A2uiTextComponent` | Renders text with basic markdown support |
| `Image` | `A2uiImageComponent` | `<img>` with src and alt bindings |
| `Icon` | `A2uiIconComponent` | Named icon from predefined set |
| `Divider` | `A2uiDividerComponent` | Horizontal rule |
| `Row` | `A2uiRowComponent` | Flex row, renders children |
| `Column` | `A2uiColumnComponent` | Flex column, renders children |
| `Card` | `A2uiCardComponent` | Card container with optional title |
| `List` | `A2uiListComponent` | Scrollable list, renders children |
| `Button` | `A2uiButtonComponent` | Clickable, primary/borderless variants (action wiring in Phase 2) |

### Components (Phase 1 — interactive, read-only rendering)

| A2UI Type | Angular Component | Description |
|-----------|------------------|-------------|
| `TextField` | `A2uiTextFieldComponent` | Text input (renders value, write-back in Phase 2) |
| `CheckBox` | `A2uiCheckBoxComponent` | Boolean toggle (renders value, write-back in Phase 2) |
| `ChoicePicker` | `A2uiChoicePickerComponent` | Option selector (renders value, write-back in Phase 2) |

Components deferred to Phase 2: `Tabs`, `Modal`, `Video`, `AudioPlayer`, `DateTimeInput`, `Slider`.

### Catalog Factory

```ts
function a2uiBasicCatalog(): ViewRegistry;
```

Returns a `ViewRegistry` mapping all Phase 1 component names to their Angular implementations.

---

## Part 4: A2UI Renderer

### Purpose

An Angular component that renders a single A2UI surface from the store. Recursively walks the component tree (from `root`), resolves data bindings, expands collection templates, and renders each component via the catalog.

### Interface

```ts
@Component({
  selector: 'a2ui-surface',
  template: `...`,
})
export class A2uiSurfaceComponent {
  readonly surface = input.required<A2uiSurface>();
  readonly catalog = input.required<ViewRegistry>();
}
```

### Data Binding Resolution

A2UI uses `DynamicString` / `DynamicNumber` / `DynamicBoolean` types for property values. These can be:
- **Literal**: `"Hello"` / `42` / `true` — pass through as-is
- **Path reference**: `{ "path": "/user/name" }` — resolve from data model via JSON Pointer
- **Function call**: `{ "call": "formatDate", "args": {...} }` — execute registered function (Phase 2, pass through as string for now)
- **Template string**: `"Hello ${/user/name}"` — interpolate paths in `${...}` syntax

```ts
function resolveDynamic(
  value: unknown,
  dataModel: Record<string, unknown>,
  scope?: { basePath: string; item: unknown },
): unknown;
```

### Template Expansion (Collections)

When `children` is `{ path: "/employees", componentId: "emp_card" }`:
1. Read the array at `/employees` from the data model
2. For each item, create a scope with `basePath = /employees/N`
3. Render the template component (`emp_card`) once per item, with relative path resolution scoped to that item

### Recursive Rendering

```
A2uiSurfaceComponent
  → finds root component (id: "root")
  → renders A2uiNodeComponent for root
    → resolves props via data bindings
    → maps component type to Angular component via catalog
    → renders children recursively (static IDs or template expansion)
```

---

## Part 5: ContentClassifier Integration

### Current State

The `ContentClassifier` already detects `---a2ui_JSON---` prefix and sets `type() === 'a2ui'`. Currently it routes to the same `PartialJsonParser` used for json-render.

### Changes

A2UI uses JSONL (one JSON object per line), not a single JSON object. The classifier needs to:
1. Detect the `---a2ui_JSON---` prefix
2. After stripping the prefix, route content to `A2uiMessageParser` (not `PartialJsonParser`)
3. Feed parsed messages to `A2uiSurfaceStore`
4. Expose new signals: `readonly a2uiSurfaces: Signal<Map<string, A2uiSurface>>`

### ChatComponent Template

```html
@if (classified.type() === 'a2ui') {
  @for (surface of classified.a2uiSurfaces() | keyvalue; track surface.key) {
    <a2ui-surface
      [surface]="surface.value"
      [catalog]="a2uiCatalog"
    />
  }
}
```

---

## Deliverables

| # | Deliverable | Package | Description |
|---|------------|---------|-------------|
| 1 | A2UI Message Parser | `@cacheplane/a2ui` (new lib) | JSONL parser + typed message envelopes |
| 2 | A2UI Surface Store | `@cacheplane/chat` | Signal-based surface state management |
| 3 | Default Component Catalog | `@cacheplane/chat` | 12 Angular components matching v0.9 basic catalog |
| 4 | A2UI Renderer | `@cacheplane/chat` | Surface rendering with data binding + template expansion |
| 5 | Classifier Integration | `@cacheplane/chat` | Wire A2UI detection to parser → store → renderer |

## Out of Scope (Phase 2)

- Client-to-server actions (event dispatch)
- Local function execution (functionCall)
- Validation system (checks array)
- Two-way data binding (input write-back)
- Tabs, Modal, Video, AudioPlayer, DateTimeInput, Slider components
- Multi-agent theme attribution
- `sendDataModel` metadata in action payloads
- Custom catalog definitions (`inlineCatalogs`)
