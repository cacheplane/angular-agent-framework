# Streaming Generative UI — Docs Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update website docs to reflect streaming generative UI auto-detection, remove `ChatGenerativeUiComponent` from the public API surface and docs, and fix all stale API references from the rebrand.

**Architecture:** MDX content files in `apps/website/content/docs/` with config in `src/lib/docs-config.ts`. New streaming guide and API pages added, existing pages updated to remove `ChatGenerativeUiComponent` references and use `views()` / `[views]` input instead of `renderRegistry` / `createAngularRegistry`. The component itself stays in the codebase (used internally by `ChatComponent`) but is no longer exported or documented.

**Tech Stack:** Next.js 16 (App Router), MDX via next-mdx-remote, TypeScript, Angular 20+ (for code examples)

---

## File Structure

### Modified Files

| File | Change |
|------|--------|
| `libs/chat/src/public-api.ts` | Remove `ChatGenerativeUiComponent` export |
| `apps/website/src/lib/docs-config.ts` | Add "Streaming" guide page, add 2 API ref pages |
| `apps/website/content/docs/chat/getting-started/introduction.mdx` | Remove `ChatGenerativeUiComponent` from primitives table, update architecture text |
| `apps/website/content/docs/chat/guides/generative-ui.mdx` | Full rewrite — streaming auto-detection as primary path |
| `apps/website/content/docs/chat/guides/configuration.mdx` | Remove `renderRegistry`, replace with `views` input |
| `apps/website/content/docs/chat/api/chat-config.mdx` | Remove `renderRegistry` property, update interface |
| `apps/website/content/docs/chat/api/provide-chat.mdx` | Remove `renderRegistry` references, update examples |
| `apps/website/content/docs/chat/components/chat.mdx` | Add `views` and `store` inputs, document auto-detection |
| `apps/website/src/components/landing/FairComparisonSection.tsx` | Update generative UI row |
| `apps/website/src/components/landing/ChatFeaturesSection.tsx` | Update generative UI feature |

### New Files

| File | Purpose |
|------|---------|
| `apps/website/content/docs/chat/guides/streaming.mdx` | Streaming content classification guide |
| `apps/website/content/docs/chat/api/content-classifier.mdx` | `createContentClassifier()` API reference |
| `apps/website/content/docs/chat/api/parse-tree-store.mdx` | `createParseTreeStore()` API reference |

---

### Task 1: Remove `ChatGenerativeUiComponent` from Public API

**Files:**
- Modify: `libs/chat/src/public-api.ts`

- [ ] **Step 1: Remove the export**

In `libs/chat/src/public-api.ts`, remove this line:

```ts
export { ChatGenerativeUiComponent } from './lib/primitives/chat-generative-ui/chat-generative-ui.component';
```

- [ ] **Step 2: Verify no external consumers**

Run: `export PATH="/Users/blove/.nvm/versions/node/v22.14.0/bin:$PATH" && npx nx run-many -t test -p chat`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/public-api.ts
git commit -m "refactor(chat): remove ChatGenerativeUiComponent from public API"
```

---

### Task 2: Register New Doc Pages in Config

**Files:**
- Modify: `apps/website/src/lib/docs-config.ts`

- [ ] **Step 1: Add "Streaming" to chat/guides**

In the chat library's `guides` section (after the "Generative UI" entry), add:

```ts
{ title: 'Streaming', slug: 'streaming', section: 'guides' },
```

The full guides array should be:

```ts
pages: [
  { title: 'Theming', slug: 'theming', section: 'guides' },
  { title: 'Markdown Rendering', slug: 'markdown', section: 'guides' },
  { title: 'Generative UI', slug: 'generative-ui', section: 'guides' },
  { title: 'Streaming', slug: 'streaming', section: 'guides' },
  { title: 'Configuration', slug: 'configuration', section: 'guides' },
],
```

- [ ] **Step 2: Add API reference pages for streaming exports**

In the chat library's `api` section, add two entries after the existing ones:

```ts
pages: [
  { title: 'provideChat()', slug: 'provide-chat', section: 'api' },
  { title: 'ChatConfig', slug: 'chat-config', section: 'api' },
  { title: 'createMockAgentRef()', slug: 'create-mock-agent-ref', section: 'api' },
  { title: 'createContentClassifier()', slug: 'content-classifier', section: 'api' },
  { title: 'createParseTreeStore()', slug: 'parse-tree-store', section: 'api' },
],
```

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/lib/docs-config.ts
git commit -m "docs(website): register streaming guide and API pages in nav config"
```

---

### Task 3: Update Chat Introduction Page

**Files:**
- Modify: `apps/website/content/docs/chat/getting-started/introduction.mdx`

- [ ] **Step 1: Remove `ChatGenerativeUiComponent` from primitives table**

Replace the row:

```
| `ChatGenerativeUiComponent` | `chat-generative-ui` | Renders a JSON spec through `@cacheplane/render` |
```

with nothing (delete the row entirely).

- [ ] **Step 2: Update the architecture description**

Replace:

```
- **`@cacheplane/render`** provides `RenderSpecComponent` and `AngularRegistry` for rendering JSON UI specs as Angular components. The `ChatGenerativeUiComponent` primitive delegates to `@cacheplane/render` under the hood, and you configure the registry through `provideChat()`.
```

with:

```
- **`@cacheplane/render`** provides `RenderSpecComponent` and view registries for rendering JSON UI specs as Angular components. The `ChatComponent` auto-detects JSON specs in AI messages and renders them through `@cacheplane/render` — pass a view registry via the `[views]` input.
```

- [ ] **Step 3: Commit**

```bash
git add apps/website/content/docs/chat/getting-started/introduction.mdx
git commit -m "docs(chat): remove ChatGenerativeUiComponent from introduction"
```

---

### Task 4: Rewrite Generative UI Guide

**Files:**
- Modify: `apps/website/content/docs/chat/guides/generative-ui.mdx`

- [ ] **Step 1: Replace the entire file with the updated guide**

Write the full content of `apps/website/content/docs/chat/guides/generative-ui.mdx`:

```mdx
# Generative UI

Generative UI lets your LangGraph agent return structured JSON specs that render as Angular components in the chat. The `ChatComponent` auto-detects JSON specs in AI messages and renders them — no manual wiring needed.

## How It Works

When AI messages stream token-by-token, the `ChatComponent` classifies each message's content automatically:

```
AI message content (token by token)
  → ContentClassifier (auto-detect per message)
    → First non-whitespace is { → JSON spec path
    → Anything else → Markdown path
  → ChatComponent template renders both:
    → Markdown prose via renderMarkdown()
    → JSON specs via RenderSpecComponent + your view registry
```

The JSON path uses `@cacheplane/partial-json` to parse incomplete JSON character-by-character, producing a live `Spec` signal with structural sharing — unchanged elements keep the same object reference so Angular skips re-rendering them.

## Setup

Pass a `ViewRegistry` via the `[views]` input on `ChatComponent`:

```typescript
import { Component, signal } from '@angular/core';
import { agent } from '@cacheplane/angular';
import { ChatComponent, views } from '@cacheplane/chat';
import type { BaseMessage } from '@langchain/core/messages';
import { WeatherCardComponent } from './weather-card.component';
import { ChartComponent } from './chart.component';

const myViews = views({
  weather_card: WeatherCardComponent,
  chart: ChartComponent,
});

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [ChatComponent],
  template: `
    <div style="height: 100vh;">
      <chat [ref]="chatRef" [views]="myViews" />
    </div>
  `,
})
export class ChatPageComponent {
  chatRef = agent<{ messages: BaseMessage[] }>({
    assistantId: 'gen_ui_agent',
    threadId: signal(null),
  });

  myViews = myViews;
}
```

That's it. When the agent returns a JSON spec as a message, `ChatComponent` detects it and renders through your view registry.

## Creating View Components

Each view component receives its props as Angular inputs. The component name in the spec's `type` field maps to the key in your `views()` call.

```typescript
// weather-card.component.ts
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-weather-card',
  standalone: true,
  template: `
    <div class="p-4 rounded-lg border">
      <h3 class="font-bold">{{ city() }}</h3>
      <p>{{ temperature() }}°F — {{ condition() }}</p>
    </div>
  `,
})
export class WeatherCardComponent {
  readonly city = input.required<string>();
  readonly temperature = input.required<number>();
  readonly condition = input.required<string>();
}
```

When the agent returns:

```json
{
  "root": "r1",
  "elements": {
    "r1": {
      "type": "weather_card",
      "props": {
        "city": "Seattle",
        "temperature": 62,
        "condition": "Cloudy"
      }
    }
  }
}
```

The render pipeline instantiates `WeatherCardComponent` with those props.

## Streaming Behavior

Because the JSON is parsed character-by-character as tokens arrive:

- Components render as soon as enough of the spec is available
- String props grow visibly as tokens stream (e.g., a title filling in letter by letter)
- Completed elements keep their object reference — only the currently-streaming element triggers re-renders
- The `loading` input is `true` while the agent is still streaming

## State Store

For interactive generative UI (forms, selections), pass a `StateStore` via the `[store]` input:

```typescript
import { signalStateStore } from '@cacheplane/render';

@Component({
  template: `
    <chat [ref]="chatRef" [views]="myViews" [store]="store" />
  `,
})
export class InteractiveChatComponent {
  store = signalStateStore({ selectedItem: null });
  // ...
}
```

The store enables two-way data binding between generative UI components and your application via `$state` and `$bindState` prop expressions in specs.

## What's Next

<CardGroup cols={2}>
  <Card
    title="Streaming Guide"
    icon="zap"
    href="/docs/chat/guides/streaming"
  >
    Deep dive into content classification, partial JSON parsing, and the streaming pipeline.
  </Card>
  <Card
    title="Specs & Elements"
    icon="code"
    href="/docs/render/guides/specs"
  >
    Full reference for the JSON spec format, prop expressions, and element types.
  </Card>
</CardGroup>
```

- [ ] **Step 2: Verify the website builds**

Run: `export PATH="/Users/blove/.nvm/versions/node/v22.14.0/bin:$PATH" && npx nx build website 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add apps/website/content/docs/chat/guides/generative-ui.mdx
git commit -m "docs(chat): rewrite generative UI guide for streaming auto-detection"
```

---

### Task 5: Create Streaming Guide

**Files:**
- Create: `apps/website/content/docs/chat/guides/streaming.mdx`

- [ ] **Step 1: Write the streaming guide**

Create `apps/website/content/docs/chat/guides/streaming.mdx`:

```mdx
# Streaming

The `ChatComponent` automatically classifies AI message content and routes it to the appropriate renderer. This page explains how the streaming pipeline works and how to use the classification APIs directly for custom integrations.

## Content Classification

Each AI message is processed by a `ContentClassifier` that examines the content as it streams token-by-token. The classifier determines the content type from the first non-whitespace character:

| Trigger | Content Type | What Happens |
|---------|-------------|--------------|
| First non-whitespace is `{` | `json-render` | Parsed as a JSON spec via `@cacheplane/partial-json` |
| Any other text | `markdown` | Rendered as markdown prose |

<Callout type="info" title="Per-message classification">
Each message gets its own classifier instance. Classification happens once per message — the type is determined by the first meaningful character and never changes.
</Callout>

## The Streaming Pipeline

For JSON spec messages, the pipeline is:

```
Tokens arrive character-by-character
  → ContentClassifier detects { → switches to json-render mode
  → PartialJsonParser builds a parse tree incrementally
  → ParseTreeStore materializes tree → Spec signal (structural sharing)
  → RenderSpecComponent renders with element-level memoization
```

**Structural sharing** means that when a new token arrives, only the affected element's object reference changes. Sibling elements keep the same reference, so Angular's change detection skips them entirely. This makes streaming efficient even for large specs with many elements.

## Using ContentClassifier Directly

For custom message rendering outside of `ChatComponent`, use `createContentClassifier()`:

```typescript
import { createContentClassifier } from '@cacheplane/chat';

// Create a classifier instance (must be in an Angular injection context)
const classifier = createContentClassifier();

// Feed content snapshots — the classifier computes deltas internally
classifier.update('{"root":"r1","elements":{"r1":{"type":"Te');
classifier.update('{"root":"r1","elements":{"r1":{"type":"Text","props":{"label":"Hello"}}}}');

// Read reactive signals
console.log(classifier.type());         // 'json-render'
console.log(classifier.spec());         // { root: 'r1', elements: { ... } }
console.log(classifier.markdown());     // '' (empty for pure JSON)
console.log(classifier.streaming());    // false (complete JSON)

// Clean up when done
classifier.dispose();
```

### Signals

| Signal | Type | Description |
|--------|------|-------------|
| `type` | `Signal<ContentType>` | `'undetermined'`, `'markdown'`, `'json-render'`, `'a2ui'`, or `'mixed'` |
| `markdown` | `Signal<string>` | Accumulated markdown prose (empty for pure JSON) |
| `spec` | `Signal<Spec \| null>` | Materialized JSON-render spec with structural sharing |
| `elementStates` | `Signal<Map<string, ElementAccumulationState>>` | Per-element tracking of which properties have been received |
| `streaming` | `Signal<boolean>` | `true` while content is still arriving |

### ContentType

```typescript
type ContentType = 'undetermined' | 'markdown' | 'json-render' | 'a2ui' | 'mixed';
```

## Using ParseTreeStore Directly

For lower-level control over JSON-to-Spec materialization:

```typescript
import { createPartialJsonParser } from '@cacheplane/partial-json';
import { createParseTreeStore } from '@cacheplane/chat';

const parser = createPartialJsonParser();
const store = createParseTreeStore(parser);

// Feed tokens
store.push('{"root":"r1","elements":{"r1":{"type":"Text"');
console.log(store.spec());  // partial spec with r1.type = "Text"

store.push(',"props":{"label":"Hello"}}}}');
console.log(store.spec());  // complete spec

// Track element accumulation
const states = store.elementStates();
console.log(states.get('r1'));
// { hasType: true, hasProps: true, hasChildren: false, streaming: false }
```

### ElementAccumulationState

```typescript
interface ElementAccumulationState {
  hasType: boolean;      // /elements/{key}/type received
  hasProps: boolean;     // /elements/{key}/props received
  hasChildren: boolean;  // /elements/{key}/children received
  streaming: boolean;    // still receiving data for this element
}
```

## What's Next

<CardGroup cols={2}>
  <Card
    title="Generative UI"
    icon="layout"
    href="/docs/chat/guides/generative-ui"
  >
    Set up view registries and render JSON specs in chat messages.
  </Card>
  <Card
    title="ContentClassifier API"
    icon="book"
    href="/docs/chat/api/content-classifier"
  >
    Full API reference for createContentClassifier().
  </Card>
</CardGroup>
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/content/docs/chat/guides/streaming.mdx
git commit -m "docs(chat): add streaming content classification guide"
```

---

### Task 6: Create API Reference Pages

**Files:**
- Create: `apps/website/content/docs/chat/api/content-classifier.mdx`
- Create: `apps/website/content/docs/chat/api/parse-tree-store.mdx`

- [ ] **Step 1: Create ContentClassifier API page**

Create `apps/website/content/docs/chat/api/content-classifier.mdx`:

```mdx
# createContentClassifier()

Factory function that creates a `ContentClassifier` — a stateful, per-message service that detects content type from the token stream and routes to the appropriate parser.

**Import:**

```typescript
import { createContentClassifier } from '@cacheplane/chat';
import type { ContentClassifier, ContentType } from '@cacheplane/chat';
```

## Signature

```typescript
function createContentClassifier(): ContentClassifier
```

**Returns:** `ContentClassifier` — a stateful classifier instance. Must be called within an Angular injection context (signals require it).

## ContentClassifier Interface

```typescript
interface ContentClassifier {
  /** Feed the full message content snapshot. Internally computes delta. */
  update(content: string): void;

  /** Detected content type. */
  readonly type: Signal<ContentType>;

  /** Accumulated markdown prose. Empty for pure JSON messages. */
  readonly markdown: Signal<string>;

  /** Materialized JSON-render spec. Null until JSON is detected. */
  readonly spec: Signal<Spec | null>;

  /** Per-element accumulation tracking. */
  readonly elementStates: Signal<Map<string, ElementAccumulationState>>;

  /** True while content is still arriving. */
  readonly streaming: Signal<boolean>;

  /** Clean up resources. */
  dispose(): void;
}
```

## ContentType

```typescript
type ContentType = 'undetermined' | 'markdown' | 'json-render' | 'a2ui' | 'mixed';
```

| Value | Meaning |
|-------|---------|
| `undetermined` | No content received yet |
| `markdown` | Plain text / markdown prose |
| `json-render` | JSON spec detected (first non-whitespace is `{`) |
| `a2ui` | A2UI payload detected (future) |
| `mixed` | Markdown followed by structured content (future) |

## Usage

```typescript
const classifier = createContentClassifier();

// Feed full content snapshots — delta is computed internally
classifier.update('Hello world');
classifier.type();      // 'markdown'
classifier.markdown();  // 'Hello world'

// For JSON content
const jsonClassifier = createContentClassifier();
jsonClassifier.update('{"root":"r1","elements":{}}');
jsonClassifier.type();  // 'json-render'
jsonClassifier.spec();  // { root: 'r1', elements: {} }

// Always dispose when done
classifier.dispose();
```

<Callout type="tip" title="Delta processing">
Pass the **full** message content each time, not just new characters. The classifier tracks `processedLength` internally and only processes the delta.
</Callout>
```

- [ ] **Step 2: Create ParseTreeStore API page**

Create `apps/website/content/docs/chat/api/parse-tree-store.mdx`:

```mdx
# createParseTreeStore()

Factory function that creates a `ParseTreeStore` — a bridge between the `@cacheplane/partial-json` parser and Angular's signal-based `Spec` rendering. It materializes the parse tree into a `Spec` signal with structural sharing on each push.

**Import:**

```typescript
import { createParseTreeStore } from '@cacheplane/chat';
import type { ParseTreeStore, ElementAccumulationState } from '@cacheplane/chat';
```

## Signature

```typescript
function createParseTreeStore(parser: PartialJsonParser): ParseTreeStore
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `parser` | `PartialJsonParser` | A parser instance from `createPartialJsonParser()` in `@cacheplane/partial-json` |

**Returns:** `ParseTreeStore` — must be called within an Angular injection context.

## ParseTreeStore Interface

```typescript
interface ParseTreeStore {
  /** Push characters to the parser and update signals. */
  push(chunk: string): void;

  /** Current materialized spec (structurally shared between updates). */
  readonly spec: Signal<Spec | null>;

  /** Per-element accumulation tracking. */
  readonly elementStates: Signal<Map<string, ElementAccumulationState>>;
}
```

## ElementAccumulationState

```typescript
interface ElementAccumulationState {
  hasType: boolean;      // /elements/{key}/type received
  hasProps: boolean;     // /elements/{key}/props received
  hasChildren: boolean;  // /elements/{key}/children received
  streaming: boolean;    // still receiving data for this element
}
```

## Usage

```typescript
import { createPartialJsonParser } from '@cacheplane/partial-json';
import { createParseTreeStore } from '@cacheplane/chat';

const parser = createPartialJsonParser();
const store = createParseTreeStore(parser);

store.push('{"root":"r1","elements":{"r1":{"type":"Text"');
store.spec();  // partial Spec — r1 has type "Text" but no props yet

store.push(',"props":{"label":"Hello"}}}}');
store.spec();  // complete Spec

// Element tracking
store.elementStates().get('r1');
// { hasType: true, hasProps: true, hasChildren: false, streaming: false }
```

<Callout type="info" title="Structural sharing">
The `spec` signal uses structural sharing. When a new token updates one element, sibling elements keep the same object reference. Angular's `computed()` with `Object.is` equality skips re-evaluation for unchanged elements.
</Callout>
```

- [ ] **Step 3: Commit**

```bash
git add apps/website/content/docs/chat/api/content-classifier.mdx apps/website/content/docs/chat/api/parse-tree-store.mdx
git commit -m "docs(chat): add ContentClassifier and ParseTreeStore API references"
```

---

### Task 7: Update ChatComponent Docs

**Files:**
- Modify: `apps/website/content/docs/chat/components/chat.mdx`

- [ ] **Step 1: Add `views` and `store` inputs to the API table**

In the **Inputs** table, add two new rows:

```
| `views` | `ViewRegistry \| undefined` | `undefined` | View registry for generative UI. Maps spec type names to Angular components. Created with `views()` from `@cacheplane/chat`. |
| `store` | `StateStore \| undefined` | `undefined` | Optional state store for interactive generative UI specs. |
```

The full table should be:

```
| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `ref` | `AgentRef<any, any>` | **Required** | The agent ref providing streaming state. Created by `agent()` from `@cacheplane/angular`. |
| `views` | `ViewRegistry \| undefined` | `undefined` | View registry for generative UI. Maps spec type names to Angular components. Created with `views()` from `@cacheplane/chat`. |
| `store` | `StateStore \| undefined` | `undefined` | Optional state store for interactive generative UI specs. |
| `threads` | `Thread[]` | `[]` | List of threads to display in the sidebar. Each thread must have an `id` property. |
| `activeThreadId` | `string` | `''` | The ID of the currently active thread, used for highlighting in the sidebar. |
```

- [ ] **Step 2: Add generative UI section after "Message Templates"**

After the "Message Templates" section, add:

```mdx
## Generative UI

When you pass a `[views]` registry, the component auto-detects JSON specs in AI messages and renders them as Angular components:

```html
<chat [ref]="chatRef" [views]="myViews" />
```

```typescript
import { views } from '@cacheplane/chat';
import { WeatherCardComponent } from './weather-card.component';

const myViews = views({
  weather_card: WeatherCardComponent,
});
```

AI messages containing JSON are parsed character-by-character as tokens stream. Components render incrementally — string props grow visibly as tokens arrive. See the [Generative UI guide](/docs/chat/guides/generative-ui) for full setup.
```

- [ ] **Step 3: Commit**

```bash
git add apps/website/content/docs/chat/components/chat.mdx
git commit -m "docs(chat): add views and store inputs to ChatComponent docs"
```

---

### Task 8: Update Configuration and API Pages

**Files:**
- Modify: `apps/website/content/docs/chat/guides/configuration.mdx`
- Modify: `apps/website/content/docs/chat/api/chat-config.mdx`
- Modify: `apps/website/content/docs/chat/api/provide-chat.mdx`

- [ ] **Step 1: Update configuration guide**

In `apps/website/content/docs/chat/guides/configuration.mdx`:

Remove `renderRegistry` from the `ChatConfig` interface definition and the options table.

Update the `provideChat()` example to not include `renderRegistry`:

```typescript
provideChat({
  avatarLabel: 'AI',
  assistantName: 'My Assistant',
}),
```

Update the options table to only include `avatarLabel` and `assistantName`:

```
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `avatarLabel` | `string` | `"A"` | Single character or short string displayed in the AI avatar badge next to assistant messages. |
| `assistantName` | `string` | `"Assistant"` | Display name for the AI assistant, used in labels and ARIA attributes. |
```

- [ ] **Step 2: Update ChatConfig API reference**

In `apps/website/content/docs/chat/api/chat-config.mdx`:

Update the interface definition to remove `renderRegistry`:

```typescript
interface ChatConfig {
  /** Override the default AI avatar label (default: "A"). */
  avatarLabel?: string;

  /** Override the default assistant display name (default: "Assistant"). */
  assistantName?: string;
}
```

Remove the entire `### renderRegistry` section (lines 28-53).

Remove the "Relationship to Other Types" table that references `AngularRegistry`.

- [ ] **Step 3: Update provideChat() API reference**

In `apps/website/content/docs/chat/api/provide-chat.mdx`:

Update the initial example to remove `renderRegistry`:

```typescript
provideChat({
  avatarLabel: 'AI',
  assistantName: 'My Assistant',
}),
```

Update the "Configuration Options" table to remove `renderRegistry`:

```
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `avatarLabel` | `string` | `"A"` | AI avatar badge text |
| `assistantName` | `string` | `"Assistant"` | AI assistant display name |
```

Update the "Application-Wide Configuration" example: remove `createAngularRegistry` import and `renderRegistry` usage:

```typescript
// app.config.ts
import { provideAgent } from '@cacheplane/angular';
import { provideChat } from '@cacheplane/chat';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAgent({ apiUrl: 'http://localhost:2024' }),
    provideChat({
      avatarLabel: 'B',
      assistantName: 'Bot',
    }),
  ],
};
```

Update the "Route-Level Configuration" example to remove `renderRegistry: codeWidgetRegistry`:

```typescript
{
  path: 'coding',
  loadComponent: () => import('./coding/code-chat.component'),
  providers: [
    provideChat({
      assistantName: 'Code Helper',
      avatarLabel: 'C',
    }),
  ],
},
```

Update the "Without provideChat()" section: change "No render registry (generative UI disabled)" to "Generative UI requires `[views]` input on `ChatComponent`".

Update the "What's Next" card for "Generative UI" description from "Set up renderRegistry for dynamic UI components." to "Set up view registries for dynamic UI components."

- [ ] **Step 4: Commit**

```bash
git add apps/website/content/docs/chat/guides/configuration.mdx apps/website/content/docs/chat/api/chat-config.mdx apps/website/content/docs/chat/api/provide-chat.mdx
git commit -m "docs(chat): remove renderRegistry from configuration and API docs"
```

---

### Task 9: Update Landing Page References

**Files:**
- Modify: `apps/website/src/components/landing/FairComparisonSection.tsx`
- Modify: `apps/website/src/components/landing/ChatFeaturesSection.tsx`

- [ ] **Step 1: Update FairComparisonSection**

In `apps/website/src/components/landing/FairComparisonSection.tsx`, change line 29:

From:
```ts
with: '<chat-generative-ui> + <render-spec> + registry',
```

To:
```ts
with: 'Auto-detected from stream + <render-spec> + views()',
```

- [ ] **Step 2: Update ChatFeaturesSection**

In `apps/website/src/components/landing/ChatFeaturesSection.tsx`, update the `genui` entry (lines 188-193):

From:
```ts
genui: {
  label: 'Generative UI', color: '#1a7a40', rgb: '26,122,64', badgeText: 'chat-generative-ui',
  left:  [{ tag: '<chat-generative-ui>', body: 'Intercepts onCustomEvent from the agent stream. Wraps <render-spec> and your component registry.', color: '#1a7a40', rgb: '26,122,64' }],
  right: [{ tag: '<render-spec>', body: 'Resolves your Angular component by name, passes props as signals, streams JSON patch updates.', color: '#1a7a40', rgb: '26,122,64' }],
  question: 'Show Q4 revenue by region.', run: runGenUI,
},
```

To:
```ts
genui: {
  label: 'Generative UI', color: '#1a7a40', rgb: '26,122,64', badgeText: 'streaming auto-detect',
  left:  [{ tag: 'ContentClassifier', body: 'Auto-detects JSON specs in AI messages. Streams partial JSON character-by-character with structural sharing.', color: '#1a7a40', rgb: '26,122,64' }],
  right: [{ tag: '<render-spec>', body: 'Resolves your Angular component by name, passes props as signals, renders incrementally as tokens arrive.', color: '#1a7a40', rgb: '26,122,64' }],
  question: 'Show Q4 revenue by region.', run: runGenUI,
},
```

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/landing/FairComparisonSection.tsx apps/website/src/components/landing/ChatFeaturesSection.tsx
git commit -m "docs(website): update landing page generative UI references"
```

---

### Task 10: Final Verification

**Files:** All modified files

- [ ] **Step 1: Build the website**

Run: `export PATH="/Users/blove/.nvm/versions/node/v22.14.0/bin:$PATH" && npx nx build website 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 2: Run chat library tests**

Run: `export PATH="/Users/blove/.nvm/versions/node/v22.14.0/bin:$PATH" && npx nx test chat 2>&1 | tail -10`
Expected: ALL PASS

- [ ] **Step 3: Commit any fixes if needed**

Only if build or tests fail:

```bash
git add -A
git commit -m "fix: address build issues from docs update"
```
