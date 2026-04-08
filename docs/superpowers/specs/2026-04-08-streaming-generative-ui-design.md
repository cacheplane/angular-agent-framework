# Streaming Generative UI — Design Spec

**Date:** 2026-04-08
**Status:** Draft — pending spike verification

## Goal

The `ChatComponent` should auto-detect and render generative UI content (json-render Spec, A2UI, or markdown) from AI message streams. This requires:

1. A custom **partial JSON parser** library with a tree-based data structure that supports character-level streaming of property values
2. A **content classifier** that detects content type and routes to the appropriate parser
3. **Render lib optimizations** for efficient re-rendering when the spec changes incrementally
4. **Chat component integration** that wires classification, parsing, and rendering together

## Architecture Overview

```
AI message content (growing token-by-token)
  → ContentClassifier (per-message, stateful)
    → Detection: JSON object? JSONL patches? A2UI delimiter? Markdown?
    → Routes to appropriate parser:
      ├── PartialJsonParser (tree-based) → character-level prop streaming
      ├── SpecStreamCompiler (@json-render/core) → JSONL patch accumulation
      ├── A2UI accumulator (future)
      └── Markdown accumulator (passthrough)
    → ParseTreeStore bridges parse tree → Spec signal (structural sharing)
  → ChatComponent template renders markdown and/or <chat-generative-ui>
  → RenderSpecComponent renders with element-level memoization
```

## Part 1: Render Lib — Element-Level Memoization

### Problem

Every patch to the `spec` signal causes every `RenderElementComponent` to recompute its `element()`, `componentClass()`, `visible()`, and `resolvedInputs()` computeds — even when the specific element hasn't changed. The `immutableSetByPath()` function from `@json-render/core` provides structural sharing (unchanged elements keep the same object reference), but `RenderElementComponent` doesn't leverage this because Angular's `computed()` tracks the `spec()` signal as a dependency and re-evaluates on every reference change.

### Solution

Use reference-equality checking on the `element()` computed so downstream computations skip when the element reference is unchanged:

```ts
// Before
readonly element = computed(() => this.spec().elements[this.elementKey()]);

// After — only propagates when the element reference actually changes
readonly element = computed(
  () => this.spec().elements?.[this.elementKey()],
  { equal: Object.is }  // Angular 19+ computed equality
);
```

### Impact

- A patch to `/elements/el-5` only triggers re-render of `el-5`, not `el-1` through `el-4`
- The `spec` signal can change on every token without cascading to all elements
- No API changes — consumers still pass a `Spec` and it renders
- The optimization is purely internal to the render lib

### Files Changed

- `libs/render/src/lib/render-element.component.ts` — add `equal` option to `element()` computed

---

## Part 2: Partial JSON Parser Library

### Purpose

A standalone, framework-agnostic TypeScript library that parses streaming JSON character-by-character into a live parse tree. Unlike existing libraries (`partial-json`, `jsonriver`) that either re-parse the full string or use opaque mutation, this library:

- Builds an explicit tree where each node has stable identity, type, value, and status
- Processes each character exactly once — O(n) total
- Emits fine-grained events (node created, value updated, node completed)
- Supports path-based observation for reactive integration
- Materializes to plain objects with structural sharing on demand

### Node Types

```ts
type JsonNodeType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';

interface JsonNode {
  /** Stable identity — assigned on creation, never changes */
  readonly id: number;

  /** What kind of JSON value this node represents */
  readonly type: JsonNodeType;

  /** Parsing state */
  status: 'pending' | 'streaming' | 'complete';

  /** Parent node (null for root) */
  parent: JsonNode | null;

  /** Key in parent — string for object properties, number for array indices */
  key: string | number | null;
}

interface JsonObjectNode extends JsonNode {
  type: 'object';
  children: Map<string, JsonNode>;
  pendingKey: string | null;
}

interface JsonArrayNode extends JsonNode {
  type: 'array';
  children: JsonNode[];
}

interface JsonStringNode extends JsonNode {
  type: 'string';
  /** Grows character-by-character as tokens arrive */
  value: string;
}

interface JsonNumberNode extends JsonNode {
  type: 'number';
  raw: string;
  value: number | null;  // Parsed when node completes
}

interface JsonBooleanNode extends JsonNode {
  type: 'boolean';
  value: boolean;
}

interface JsonNullNode extends JsonNode {
  type: 'null';
}
```

### Parser API

```ts
interface ParseEvent {
  type: 'node-created' | 'value-updated' | 'node-completed';
  node: JsonNode;
  /** For value-updated on strings: the characters appended this push */
  delta?: string;
}

interface PartialJsonParser {
  /** Feed characters. Returns events for what changed. */
  push(chunk: string): ParseEvent[];

  /** Root node of the parse tree */
  readonly root: JsonNode | null;

  /** Look up a node by JSON Pointer path */
  getByPath(path: string): JsonNode | null;

  /** Subscribe to changes at a specific path */
  observe(path: string, callback: (event: ParseEvent) => void): () => void;

  /** Materialize tree (or subtree) to a plain JS value */
  toJSON(): unknown;
  toJSON(node: JsonNode): unknown;
}
```

### Parsing State Machine

The parser maintains a stack of open container nodes and a state enum:

```
EXPECT_VALUE → IN_STRING → (back to parent state)
             → IN_NUMBER → (back to parent state)
             → IN_KEYWORD (true/false/null) → (back to parent state)
             → OPEN_OBJECT → EXPECT_KEY → IN_KEY_STRING → EXPECT_COLON → EXPECT_VALUE → ...
             → OPEN_ARRAY → EXPECT_VALUE → ...
```

Each character is processed once. String values grow via append — the `JsonStringNode.value` extends in-place and the parser emits `value-updated` with the delta.

### Materialization with Structural Sharing

`toJSON()` walks the tree and produces plain JS objects. When called repeatedly (as tokens stream), it uses structural sharing:

- Each node caches its last materialized value
- On `toJSON()`, if a node's status hasn't changed and no descendants have changed, return the cached value (same reference)
- If a descendant changed, shallow-clone ancestors up to root, reuse unchanged siblings
- This is equivalent to `immutableSetByPath()` but driven by the tree's own change tracking

### Library Boundary

- Package: `@cacheplane/partial-json` (or similar — standalone npm package)
- Zero dependencies, pure TypeScript
- No framework coupling — Angular/React/etc. integration is external
- Targets: ESM, CJS, types

---

## Part 3: Content Classifier

### Purpose

A stateful, per-message service that:
1. Detects content type from the token stream
2. Routes content to the appropriate parser
3. Exposes classified results as Angular signals

### Detection Rules (Applied in Order)

| Priority | Trigger | Content Type | Parser Used |
|----------|---------|-------------|-------------|
| 1 | First non-whitespace is `{` | `json-render` | PartialJsonParser |
| 2 | ` ```spec ` fence detected | `mixed` (or `json-render` if no preceding prose) | SpecStreamCompiler |
| 3 | Line starts with `{"op":` | `json-render` | SpecStreamCompiler |
| 4 | `---a2ui_JSON---` delimiter | `a2ui` (or `mixed` if prose precedes) | A2UI accumulator |
| 5 | Any other text | `markdown` | String accumulator |

### State Transitions

```
undetermined ──── { ──────────────────→ json-render (partial JSON path)
     │
     ├──── ```spec ───────────────────→ mixed or json-render (SpecStream path)
     │
     ├──── {"op": ───────────────────→ json-render (SpecStream path)
     │
     ├──── ---a2ui_JSON--- ──────────→ a2ui
     │
     └──── any other text ───────────→ markdown

markdown ──── ```spec ───────────────→ mixed (prose preserved, patches start)
markdown ──── ---a2ui_JSON--- ───────→ mixed (prose preserved, A2UI starts)
```

Type can upgrade (`markdown` → `mixed`) but never downgrade.

### Interface

```ts
interface ContentClassifier {
  /** Feed the full message content snapshot. Internally computes delta. */
  update(content: string): void;

  /** Reactive signals for classified output */
  readonly type: Signal<'undetermined' | 'markdown' | 'json-render' | 'a2ui' | 'mixed'>;
  readonly markdown: Signal<string>;
  readonly spec: Signal<Spec | null>;
  readonly elementStates: Signal<Map<string, ElementAccumulationState>>;
  readonly streaming: Signal<boolean>;

  dispose(): void;
}

interface ContentClassifierFactory {
  create(): ContentClassifier;
}
```

### Internal Components

Each classifier instance holds:

- `processedLength: number` — tracks how much content has been consumed
- `DetectionState` — which content type we've committed to
- `PartialJsonParser` — instantiated when JSON object detected
- `ParseTreeStore` — bridges parse tree to Spec signal with structural sharing
- `SpecStreamCompiler` (from `@json-render/core`) — for JSONL patch path
- `MixedStreamParser` (from `@json-render/core`) — splits prose from patches
- `markdownAccumulator: string` — accumulated prose
- Angular signals for all public outputs

### Delta Processing

```ts
update(content: string): void {
  const delta = content.slice(this.processedLength);
  if (!delta.length) return;
  this.processedLength = content.length;

  if (this.detectionState === 'undetermined') {
    this.detect(delta);
  }

  switch (this.detectionState) {
    case 'markdown':
      this.markdownAccumulator += delta;
      this.checkForStructuredTransition(delta);
      break;
    case 'json-render-partial':
      this.partialJsonParser.push(delta);
      // ParseTreeStore handles materialization → spec signal
      break;
    case 'json-render-specstream':
    case 'mixed':
      this.mixedStreamParser.push(delta);
      // onText → markdownAccumulator
      // onPatch → specStreamCompiler → spec signal
      break;
    case 'a2ui':
      this.a2uiAccumulator += delta;
      break;
  }

  this.updateSignals();
}
```

---

## Part 4: ParseTreeStore — Bridging Parse Tree to Render Lib

### Purpose

Adapts the PartialJsonParser's event stream into a `Spec` signal with structural sharing, plus per-element accumulation tracking. This is the glue between the parser library (framework-agnostic) and the Angular render lib.

### Interface

```ts
function createParseTreeStore(parser: PartialJsonParser): ParseTreeStore;

interface ParseTreeStore {
  /** Push characters to the parser and process events */
  push(chunk: string): void;

  /** Current materialized spec (structurally shared between updates) */
  readonly spec: Signal<Spec | null>;

  /** Per-element accumulation tracking */
  readonly elementStates: Signal<Map<string, ElementAccumulationState>>;
}
```

### ElementAccumulationState

```ts
interface ElementAccumulationState {
  hasType: boolean;           // /elements/{key}/type received
  hasProps: boolean;          // /elements/{key}/props received (at least partially)
  hasChildren: boolean;       // /elements/{key}/children received
  streaming: boolean;         // still receiving events targeting this element
}
```

### Materialization Strategy

When `push(chunk)` is called:

1. Parser processes characters, emits `ParseEvent[]`
2. Collect all affected paths from events
3. Batch-materialize: for each unique root-level change, walk up from changed node to root with shallow clones (structural sharing)
4. Update `spec` signal with the new structurally-shared Spec
5. Update `elementStates` signal from event paths

**Example — a single token extends a prop value:**

```
Event: value-updated at /elements/el-1/props/title (delta: "lo")

Materialization chain (bottom-up shallow clones):
  /elements/el-1/props/title → "Hello"          (new string)
  /elements/el-1/props       → { ...prev, title: "Hello" }  (shallow clone)
  /elements/el-1             → { ...prev, props: newProps }  (shallow clone)
  /elements                  → { ...prev, "el-1": newEl }   (shallow clone)
  spec                       → { ...prev, elements: newEls } (shallow clone)

Everything else (el-2, el-3, state, root) → previous references unchanged.
```

### Location

Lives in the `chat` library (`libs/chat`) since it bridges the framework-agnostic parser to Angular signals. Could be promoted to the `render` library if other consumers need it.

---

## Part 5: Chat Component Integration

### Template Changes

The AI message template switches from markdown-only to classified rendering:

```html
<ng-template chatMessageTemplate="ai" let-message let-index="index">
  @let classified = classifyMessage(message, index);

  <!-- Prose portion -->
  @if (classified.markdown()) {
    <div class="ai-prose" [innerHTML]="renderMd(classified.markdown())"></div>
  }

  <!-- JSON-Render spec -->
  @if (classified.spec(); as spec) {
    <chat-generative-ui
      [spec]="spec"
      [registry]="chatConfig.renderRegistry"
      [loading]="ref().isLoading()"
    />
  }

  <!-- A2UI (future) -->
  @if (classified.type() === 'a2ui') {
    <!-- A2UI renderer placeholder -->
  }
</ng-template>
```

### Classifier Lifecycle

```ts
private classifiers = new Map<number, ContentClassifier>();
private classifierFactory = inject(ContentClassifierFactory);

classifyMessage(message: BaseMessage, index: number): ContentClassifier {
  let classifier = this.classifiers.get(index);
  if (!classifier) {
    classifier = this.classifierFactory.create();
    this.classifiers.set(index, classifier);
  }
  classifier.update(messageContent(message));
  return classifier;
}
```

Classifiers are cached per message index. When messages are cleared (thread switch, reset), all classifiers are disposed and the cache is cleared.

### ChatConfig Changes

The existing `renderRegistry` field on `ChatConfig` is wired to `<chat-generative-ui>`. No new config fields needed for the initial implementation.

```ts
interface ChatConfig {
  renderRegistry?: AngularRegistry;  // Already exists — now used
  avatarLabel?: string;
  assistantName?: string;
}
```

### Pure Markdown Fast Path

When `classified.type()` is `'markdown'` and `classified.spec()` is null, the template renders only the prose div — identical to today's behavior. No parser instantiated, no spec materialization, no overhead.

---

## Part 6: A2UI Support (Future — Detection Only)

A2UI detection is included in the content classifier now, but rendering is deferred. The classifier will:

1. Detect the `---a2ui_JSON---` delimiter
2. Split prose from the A2UI JSON payload
3. Accumulate the payload into an `a2ui` signal
4. Expose `type() === 'a2ui'` or `type() === 'mixed'`

A2UI rendering requires:
- A2UI catalog/schema support (mapping A2UI component names to Angular components)
- A2UI message type handling (`createSurface`, `updateComponents`, `updateDataModel`, `deleteSurface`)
- A separate design spec when we're ready to implement

---

## Deliverables

| # | Deliverable | Package | Description |
|---|------------|---------|-------------|
| 1 | Partial JSON Parser | `@cacheplane/partial-json` (new Nx lib at `libs/partial-json`) | Tree-based streaming JSON parser with events and materialization |
| 2 | Render lib memoization | `@cacheplane/render` | Element-level reference equality on `computed()` |
| 3 | ParseTreeStore | `@cacheplane/chat` | Bridges parse tree events to Spec signals with structural sharing |
| 4 | ContentClassifier | `@cacheplane/chat` | Per-message content detection and routing |
| 5 | Chat component integration | `@cacheplane/chat` | Template + lifecycle changes for generative UI rendering |

## Spike Verification (Pre-Implementation)

Before full implementation, an end-to-end spike will validate the critical path:

**Spike scope:** Hardcoded token stream → PartialJsonParser → Spec materialization with structural sharing → `<render-spec>` rendering components that update as tokens stream.

**What it proves:**
- The parse tree correctly builds from character-by-character input
- Materialization produces valid `Spec` objects that `<render-spec>` can render
- Structural sharing works — unchanged elements keep references, render lib skips re-render
- Character-level prop streaming is visible in the rendered UI

**What it defers:**
- Content detection logic
- Integration with real LangGraph message streams
- A2UI support
- Production error handling and edge cases
