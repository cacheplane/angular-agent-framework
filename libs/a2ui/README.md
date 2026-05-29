# @threadplane/a2ui

The A2UI (Agent-to-UI) protocol type system and parsing/resolution utilities for TypeScript. Defines the wire format agents use to drive generative UI surfaces — framework-agnostic, no Angular dependency, runs in any TypeScript environment.

<p align="center">
  <a href="https://www.npmjs.com/package/@threadplane/a2ui">
    <img alt="npm version" src="https://img.shields.io/npm/v/@threadplane%2Fa2ui?color=6C8EFF&labelColor=080B14&style=flat-square" />
  </a>
  <a href="https://opensource.org/licenses/MIT">
    <img alt="MIT" src="https://img.shields.io/badge/License-MIT-6C8EFF?labelColor=080B14&style=flat-square" />
  </a>
</p>

## What it does

- **Protocol type system** — full TypeScript type vocabulary for every A2UI message, surface, component, layout, input, and media element an agent can emit.
- **Streaming message parser** — `createA2uiMessageParser()` returns a stateful parser that accepts JSONL chunks from a streaming agent response and emits typed `A2uiMessage` values as lines complete.
- **Dynamic value resolution** — `resolveDynamic()` resolves a dynamic value (literal wrapper or path-reference) against a client data model; four type guards (`isLiteralString`, `isLiteralNumber`, `isLiteralBoolean`, `isPathRef`) let you narrow dynamic values before passing them.
- **JSON-pointer utilities** — `getByPointer`, `setByPointer`, and `deleteByPointer` navigate and mutate the A2UI client data model using JSON-pointer paths.
- **Runtime-neutral** — pure TypeScript, no runtime dependencies, works in browsers and Node.js alike. Consumed by `@threadplane/chat` to render agent-emitted generative UI.

## Install

```bash
npm install @threadplane/a2ui
```

No peer dependencies required.

## Quick start

### Parse a streaming A2UI response

```typescript
import { createA2uiMessageParser } from '@threadplane/a2ui';
import type { A2uiMessage } from '@threadplane/a2ui';

const parser = createA2uiMessageParser();

// Feed chunks as they arrive from your agent's streaming response:
function onChunk(chunk: string): void {
  const messages: A2uiMessage[] = parser.push(chunk);
  for (const msg of messages) {
    if ('beginRendering' in msg) {
      console.log('New surface:', msg.beginRendering.surfaceId);
    } else if ('surfaceUpdate' in msg) {
      console.log('Surface update for:', msg.surfaceUpdate.surfaceId);
    } else if ('dataModelUpdate' in msg) {
      console.log('Data model delta:', msg.dataModelUpdate.contents);
    } else if ('deleteSurface' in msg) {
      console.log('Delete surface:', msg.deleteSurface.surfaceId);
    }
  }
}
```

### Resolve dynamic values against a data model

```typescript
import {
  resolveDynamic,
  isPathRef,
  isLiteralString,
} from '@threadplane/a2ui';

const model = { user: { name: 'Alice' } };

// Literal string wrapper
const label = resolveDynamic({ literalString: 'Submit' }, model);
// => 'Submit'

// Path reference — resolves against the model via JSON pointer
const name = resolveDynamic({ path: '/user/name' }, model);
// => 'Alice'
```

### JSON-pointer utilities

```typescript
import { getByPointer, setByPointer, deleteByPointer } from '@threadplane/a2ui';

const model = { items: [{ id: 1 }, { id: 2 }] };

getByPointer(model, '/items/0/id');       // => 1
const updated = setByPointer(model, '/items/0/id', 99);
const removed = deleteByPointer(updated, '/items/0/id');
```

## Capabilities

### Protocol message parsing

`createA2uiMessageParser()` returns an `A2uiMessageParser` with a single `push(chunk: string): A2uiMessage[]` method. The parser is stateful — it buffers partial lines between calls and emits complete messages as JSONL lines arrive. Malformed lines are silently skipped, which is safe for mid-stream partial JSON.

```typescript
const parser = createA2uiMessageParser();
const messages = parser.push(chunk); // A2uiMessage[]
```

### Dynamic value resolution

`resolveDynamic(value, model, scope?)` unwraps A2UI dynamic values:

- `{ literalString: string }`, `{ literalNumber: number }`, `{ literalBoolean: boolean }` — unwrap to the inner value.
- `{ path: string }` — looked up in `model` via JSON pointer. If an `A2uiScope` is provided, relative paths resolve against `scope.basePath`.
- Plain literals (string, number, boolean, `null`, plain objects) — passed through unchanged.

The four exported type guards narrow `unknown` values before use:

| Guard | Narrows to |
|---|---|
| `isLiteralString(v)` | `{ literalString: string }` |
| `isLiteralNumber(v)` | `{ literalNumber: number }` |
| `isLiteralBoolean(v)` | `{ literalBoolean: boolean }` |
| `isPathRef(v)` | `{ path: string }` |

### JSON-pointer utilities

Three immutable helpers operate on `Record<string, unknown>` data models:

| Function | Description |
|---|---|
| `getByPointer(model, pointer)` | Read the value at `pointer`. Returns `undefined` if the path does not exist. |
| `setByPointer(model, pointer, value)` | Return a new model with `value` written at `pointer`. |
| `deleteByPointer(model, pointer)` | Return a new model with the key at `pointer` removed. |

Pointers follow standard `/segment/segment` syntax. An empty pointer (`''` or `'/'`) targets the root.

### Type system

`@threadplane/a2ui` exports the complete A2UI type vocabulary as TypeScript `export type` declarations. Categories include:

- **Protocol messages** — `A2uiMessage`, `A2uiBeginRendering`, `A2uiSurfaceUpdate`, `A2uiDataModelUpdate`, `A2uiDeleteSurface`, `A2uiSurface`, `A2uiDataModelEntry`
- **Components and layout** — `A2uiComponent`, `A2uiComponentDef`, `A2uiRow`, `A2uiColumn`, `A2uiCard`, `A2uiList`, `A2uiTabs`, `A2uiTabItem`, `A2uiModal`, `A2uiDivider`
- **Input elements** — `A2uiButton`, `A2uiTextField`, `A2uiCheckBox`, `A2uiSlider`, `A2uiMultipleChoice`, `A2uiDateTimeInput`
- **Media and display** — `A2uiText`, `A2uiImage`, `A2uiIcon`, `A2uiVideo`, `A2uiAudioPlayer`
- **Dynamic values** — `DynamicString`, `DynamicNumber`, `DynamicBoolean`, `DynamicStringList`
- **Actions and theming** — `A2uiAction`, `A2uiActionMessage`, `A2uiActionContextEntry`, `A2uiTheme`, `A2uiClientDataModel`
- **Parser and scope** — `A2uiMessageParser`, `A2uiScope`, `A2uiChildren`

## Reliability

Pure TypeScript with no runtime dependencies. No `Buffer`, no `process`, no DOM — safe in any TypeScript environment. Follows the repo's patch-only `0.0.x` release policy. The "Library — lint / test / build" CI job runs on every pull request.

## License

MIT. See [LICENSE](../../LICENSE).
