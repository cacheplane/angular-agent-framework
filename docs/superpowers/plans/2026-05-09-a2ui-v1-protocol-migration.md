# `@ngaf/a2ui` v1 Protocol Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `@ngaf/a2ui` from the older v0.9 envelope shape (`createSurface`/`updateComponents`/`updateDataModel`) to the canonical Google A2UI v1 protocol (`surfaceUpdate`/`dataModelUpdate`/`beginRendering`/`deleteSurface`). Single PR, no backward compat.

**Architecture:** Three layers cut over together: (1) `libs/a2ui` — types + parser + resolve helpers eat v1 envelopes, dynamic values always wrapped (`{literalString}` / `{literalNumber}` / `{literalBoolean}` / `{path}`), children always wrapped (`{explicitList}` or `{template}`); (2) `libs/chat/src/lib/a2ui` — surface-store buffers `surfaceUpdate`/`dataModelUpdate` per `surfaceId` and commits atomically on `beginRendering`; surface-to-spec unwraps the type-keyed `component: { Button: {...} }` shape; build-action-message emits wrapped DynamicValue context entries; (3) `libs/chat/src/lib/a2ui/catalog/*` — 18 catalog components rewritten to read v1 props (Card has single `child`, Button has `child` Text component instead of `label`, MultipleChoice replaces ChoicePicker). Demo's `FEEDBACK_FORM_JSONL` ports to v1 shape and stays as the golden integration test until Phase 5 of the canonical demo replaces it with dynamic schema generation.

**Tech Stack:** TypeScript, Angular 21 standalone components + signals + OnPush, Vitest, Nx workspace. Python 3.12 (uv, langgraph, pytest) for the demo's hardcoded JSONL constant.

**Spec:** `docs/superpowers/specs/2026-05-09-a2ui-v1-protocol-migration-design.md` (committed at 1e8cafe7)

**Branch:** `claude/a2ui-v1-migration`, branched from `origin/main` (currently `b8e3bca9` — tip after PR #227 merged).

**Hard constraint:** Never reference hashbrown / copilotkit / chatgpt / chatbot-kit / claude in code, comments, commit messages, or PR titles/bodies. Mentions in markdown spec/plan docs are OK as third-party library names; do not propagate.

---

## File Structure

```
libs/a2ui/src/lib/
├── types.ts                                                # Full rewrite — v1 type system
├── parser.ts                                               # Update ENVELOPE_KEYS to v1 set
├── resolve.ts                                              # Adapt to wrapped DynamicValue shape
├── pointer.ts                                              # No change (path-based, agnostic)
├── functions.ts                                            # No change (pure helpers)
├── validate.ts                                             # No change to API; but spec drops CheckRule consumers
├── guards.ts                                               # Update isPathRef et al for new shapes
└── *.spec.ts                                               # Updated tests across the file group

libs/chat/src/lib/a2ui/
├── surface-store.ts                                        # Buffered apply, commit on beginRendering
├── surface-to-spec.ts                                      # Unwrap type-keyed component def
├── build-action-message.ts                                 # Wrap context values as DynamicValue
├── surface.component.ts                                    # No structural change
└── catalog/
    ├── index.ts                                            # Update registry: ChoicePicker → MultipleChoice
    ├── (15 components ported in 4 batches)                 # See Phase 3 task breakdown
    ├── multiple-choice.component.ts                        # NEW — replaces choice-picker.component.ts
    └── *.spec.ts                                           # Updated tests across the catalog

libs/chat/src/lib/streaming/
└── content-classifier.ts                                   # No-op verification — A2UI_PREFIX unchanged

examples/chat/python/src/graph.py                           # FEEDBACK_FORM_JSONL rewrite in v1 shape
examples/chat/smoke/CHECKLIST.md                            # Generative UI section update for v1 envelopes
apps/website/content/docs/chat/api/api-docs.json            # Regenerated after type changes
```

Total ≈ 1500-1800 LOC across ~30 files.

---

## Dispatch strategy

Single subagent dispatch is unrealistic for ~1800 LOC. Recommended structure (the controller drives this; subagent prompts in `superpowers:subagent-driven-development` get scoped per dispatch):

| Dispatch | Phases | Scope |
|---|---|---|
| **A** | 0, 1, 2 | Branch + foundations: types, parser, resolve, pointer, guards + chat-side store, surface-to-spec, build-action-message |
| **B1** | 3 (subset) | Catalog batch 1 (media + layout): text, image, icon, video, audio, row, column, list, divider |
| **B2** | 3 (subset) | Catalog batch 2 (containers + inputs): card, tabs, modal, button, checkbox, text-field, date-time-input, multiple-choice, slider |
| **C** | 4, 5 | Wiring verification + python demo JSONL rewrite + CHECKLIST update |
| **Controller** | 6 | Verification (build/lint/test/probe) + LIVE Chrome MCP smoke + PR open + merge |

Each dispatch reports DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED. Combined spec + code-quality review at the end of each dispatch.

---

## Phase 0 — Branch creation

### Task 0.1: Create implementation branch

- [ ] **Step 1: Branch from origin/main**

```bash
cd /Users/blove/repos/angular-agent-framework
git fetch origin main
git checkout -b claude/a2ui-v1-migration origin/main
git rev-parse --abbrev-ref HEAD   # must echo claude/a2ui-v1-migration
git log --oneline -1              # must be b8e3bca9 or later (PR #227 merged)
```

---

## Phase 1 — `libs/a2ui` types + parser + resolve

### Task 1.1: Rewrite `libs/a2ui/src/lib/types.ts` for v1

**File:** `libs/a2ui/src/lib/types.ts` (currently 135 LOC)

Full replacement. The new file must export the v1 type system as defined in the spec's "Library changes → libs/a2ui/src/lib/types.ts" section (top of spec, ~140 LOC of TypeScript). Copy it verbatim from the spec. Key points:

- `A2uiTheme` interface stays (backward-compat shim — surface-level theme is a no-op for now; spec's `beginRendering.styles` is the future home but no consumer reads it yet).
- `DynamicString` / `DynamicNumber` / `DynamicBoolean` are discriminated unions with `literalString` / `literalNumber` / `literalBoolean` / `path` keys — always wrapped, no bare literals.
- `DynamicStringList` is `{ literalArray: string[] } | { path: string }`.
- `A2uiChildren` is `{ explicitList: string[] } | { template: { componentId, dataBinding } }`.
- `A2uiAction` is `{ name: string; context?: A2uiActionContextEntry[] }` (no `event:` wrapper).
- `A2uiComponent` is `{ id: string; weight?: number; component: A2uiComponentDef }`.
- `A2uiComponentDef` is the discriminated union of all 18 components, each as a single-key object: `{ Button: A2uiButton } | { Text: A2uiText } | ...`.
- 18 per-component property interfaces (`A2uiButton`, `A2uiText`, `A2uiTextField`, `A2uiCard`, `A2uiMultipleChoice`, etc.) — copy from spec.
- 4 envelope interfaces (`A2uiSurfaceUpdate`, `A2uiDataModelUpdate`, `A2uiBeginRendering`, `A2uiDeleteSurface`).
- `A2uiMessage` is the discriminated union of envelopes, each wrapped: `{ surfaceUpdate: ... } | { dataModelUpdate: ... } | ...`.
- `A2uiSurface` keeps its current shape — `{ surfaceId, catalogId, theme?, sendDataModel?, components: Map<string, A2uiComponent>, dataModel: Record<string, unknown> }` — internal model not constrained by wire format.
- `A2uiClientDataModel` and `A2uiActionMessage` stay (outbound shapes); update `A2uiActionMessage.action.context` to the new wrapped-value array.
- **REMOVE**: `A2uiPathRef`, `A2uiFunctionCall`, `A2uiCheckRule`, `A2uiEventAction`, `A2uiLocalAction`, the old `A2uiCreateSurface`, `A2uiUpdateComponents`, `A2uiUpdateDataModel`, the old `A2uiAction` union — these are v0.9 carry-overs that no longer apply.
- **KEEP**: `A2uiDeleteSurface` (envelope shape unchanged), `A2uiTheme` (forward-compat).

- [ ] **Step 1: Write the failing test file**

Create `libs/a2ui/src/lib/types.spec.ts` (replacing any existing content):

```ts
// SPDX-License-Identifier: MIT
import { describe, expect, test } from 'vitest';
import type {
  A2uiMessage, A2uiComponentDef, DynamicString, DynamicNumber,
  A2uiButton, A2uiText, A2uiTextField, A2uiCard, A2uiMultipleChoice,
  A2uiSurfaceUpdate, A2uiBeginRendering, A2uiDataModelUpdate,
} from './types';

describe('a2ui v1 types', () => {
  test('DynamicString accepts literalString or path', () => {
    const lit: DynamicString = { literalString: 'hello' };
    const ref: DynamicString = { path: '/title' };
    expect(lit).toBeDefined();
    expect(ref).toBeDefined();
  });

  test('A2uiComponentDef is discriminated by component type key', () => {
    const button: A2uiComponentDef = {
      Button: { child: 'btn-text', action: { name: 'click' } },
    };
    const text: A2uiComponentDef = {
      Text: { text: { literalString: 'Hi' } },
    };
    expect('Button' in button).toBe(true);
    expect('Text' in text).toBe(true);
  });

  test('A2uiMessage discriminated by envelope key', () => {
    const surfaceUpdate: A2uiMessage = {
      surfaceUpdate: {
        surfaceId: 's1',
        components: [
          { id: 'root', component: { Card: { child: 'inner' } } },
        ],
      },
    };
    const beginRendering: A2uiMessage = {
      beginRendering: { surfaceId: 's1', root: 'root' },
    };
    expect('surfaceUpdate' in surfaceUpdate).toBe(true);
    expect('beginRendering' in beginRendering).toBe(true);
  });

  test('A2uiTextField uses wrapped DynamicString for label and text', () => {
    const tf: A2uiTextField = {
      label: { literalString: 'Name' },
      text: { path: '/name' },
      textFieldType: 'shortText',
    };
    expect(tf.label).toEqual({ literalString: 'Name' });
  });

  test('A2uiCard has single child (not array)', () => {
    const card: A2uiCard = { child: 'inner' };
    expect(card.child).toBe('inner');
  });

  test('A2uiMultipleChoice has selections + options + maxAllowedSelections', () => {
    const mc: A2uiMultipleChoice = {
      selections: { path: '/picked' },
      options: [
        { label: { literalString: 'A' }, value: 'a' },
        { label: { literalString: 'B' }, value: 'b' },
      ],
      maxAllowedSelections: 1,
    };
    expect(mc.options).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run — must FAIL (types don't exist yet)**

```bash
cd /Users/blove/repos/angular-agent-framework
export PATH=/Users/blove/.nvm/versions/node/v22.14.0/bin:$PATH
npx nx test a2ui --skip-nx-cache 2>&1 | tail -10
```

Expected: type errors / test failures because the v1 types aren't defined.

- [ ] **Step 3: Replace `libs/a2ui/src/lib/types.ts` with the v1 type system**

Use the full type definitions from the spec's "Library changes → libs/a2ui/src/lib/types.ts" section. The full type body is approximately 180 LOC; it includes:

- `A2uiTheme`
- `DynamicString` | `DynamicNumber` | `DynamicBoolean` | `DynamicStringList`
- `A2uiChildren`
- `A2uiActionContextEntry` + `A2uiAction`
- `A2uiComponent` + `A2uiComponentDef` (discriminated union)
- 18 per-component interfaces: `A2uiText`, `A2uiImage`, `A2uiIcon`, `A2uiVideo`, `A2uiAudioPlayer`, `A2uiRow`, `A2uiColumn`, `A2uiList`, `A2uiCard`, `A2uiTabs`, `A2uiDivider`, `A2uiModal`, `A2uiButton`, `A2uiCheckBox`, `A2uiTextField`, `A2uiDateTimeInput`, `A2uiMultipleChoice`, `A2uiSlider`
- `A2uiSurfaceUpdate`, `A2uiDataModelEntry`, `A2uiDataModelUpdate`, `A2uiBeginRendering`, `A2uiDeleteSurface`
- `A2uiMessage` (discriminated union)
- `A2uiSurface` (kept from v0.9)
- `A2uiClientDataModel`, `A2uiActionMessage` (outbound, updated)

Field-level reference: see spec section "Library changes → libs/a2ui/src/lib/types.ts" for the canonical TypeScript source. Where the spec elides per-component property details, infer from the v1 JSON schema embedded in the spec's "Reference: A2UI v1 component property reference" section (or, if absent, from `/Users/blove/repos/SC-CopilotKit-C1/L4/backend-dynamic/schema.py` SCHEMA_PROMPT).

- [ ] **Step 4: Update `libs/a2ui/src/index.ts` exports**

The existing index.ts re-exports v0.9 names. Replace with the v1 export set:

```ts
// SPDX-License-Identifier: MIT
export type {
  A2uiTheme,
  DynamicString, DynamicNumber, DynamicBoolean, DynamicStringList,
  A2uiChildren, A2uiActionContextEntry, A2uiAction,
  A2uiComponent, A2uiComponentDef,
  A2uiText, A2uiImage, A2uiIcon, A2uiVideo, A2uiAudioPlayer,
  A2uiRow, A2uiColumn, A2uiList, A2uiCard, A2uiTabs, A2uiDivider, A2uiModal,
  A2uiButton, A2uiCheckBox, A2uiTextField, A2uiDateTimeInput, A2uiMultipleChoice, A2uiSlider,
  A2uiSurfaceUpdate, A2uiDataModelEntry, A2uiDataModelUpdate, A2uiBeginRendering, A2uiDeleteSurface,
  A2uiMessage, A2uiSurface,
  A2uiClientDataModel, A2uiActionMessage,
} from './lib/types.js';
export { getByPointer, setByPointer, deleteByPointer } from './lib/pointer.js';
export { createA2uiMessageParser } from './lib/parser.js';
export type { A2uiMessageParser } from './lib/parser.js';
export { resolveDynamic } from './lib/resolve.js';
export type { A2uiScope } from './lib/resolve.js';
export { executeFunction } from './lib/functions.js';
export { isLiteralString, isLiteralNumber, isLiteralBoolean, isPathRef } from './lib/guards.js';
```

Note: removed exports — `A2uiPathRef`, `A2uiFunctionCall`, `A2uiCheckRule`, `A2uiEventAction`, `A2uiLocalAction`, `A2uiCreateSurface`, `A2uiUpdateComponents`, `A2uiUpdateDataModel`, `evaluateCheckRules`, `A2uiValidationResult`, `isFunctionCall` (drop CheckRule per spec decision 3).

- [ ] **Step 5: Run — types compile**

```bash
npx nx test a2ui --skip-nx-cache 2>&1 | tail -10
```

Expected: `types.spec.ts` passes. Other a2ui tests likely fail at this point (parser, resolve, etc. still v0.9-shaped) — that's intentional, the next tasks fix them.

- [ ] **Step 6: Commit**

```bash
git add libs/a2ui/src/lib/types.ts libs/a2ui/src/lib/types.spec.ts libs/a2ui/src/index.ts
git commit -m "feat(a2ui): rewrite types for v1 protocol"
```

### Task 1.2: Rewrite `libs/a2ui/src/lib/parser.ts` for v1 envelope keys

**File:** `libs/a2ui/src/lib/parser.ts` (currently 47 LOC)

The parser stays JSONL-line-based; only the envelope key set changes and the return shape (`A2uiMessage` is now a discriminated union of wrapped envelopes, not flat `{type, ...payload}`).

- [ ] **Step 1: Write the failing test**

Replace `libs/a2ui/src/lib/parser.spec.ts` with:

```ts
// SPDX-License-Identifier: MIT
import { describe, expect, test } from 'vitest';
import { createA2uiMessageParser } from './parser';

describe('createA2uiMessageParser (v1)', () => {
  test('parses surfaceUpdate envelope', () => {
    const parser = createA2uiMessageParser();
    const msgs = parser.push(JSON.stringify({
      surfaceUpdate: {
        surfaceId: 's1',
        components: [{ id: 'root', component: { Card: { child: 'inner' } } }],
      },
    }) + '\n');
    expect(msgs).toHaveLength(1);
    expect('surfaceUpdate' in msgs[0]).toBe(true);
  });

  test('parses dataModelUpdate envelope', () => {
    const parser = createA2uiMessageParser();
    const msgs = parser.push(JSON.stringify({
      dataModelUpdate: {
        surfaceId: 's1',
        contents: [{ key: 'name', valueString: 'Brian' }],
      },
    }) + '\n');
    expect(msgs).toHaveLength(1);
    expect('dataModelUpdate' in msgs[0]).toBe(true);
  });

  test('parses beginRendering envelope', () => {
    const parser = createA2uiMessageParser();
    const msgs = parser.push(JSON.stringify({
      beginRendering: { surfaceId: 's1', root: 'root' },
    }) + '\n');
    expect(msgs).toHaveLength(1);
    expect('beginRendering' in msgs[0]).toBe(true);
  });

  test('parses deleteSurface envelope', () => {
    const parser = createA2uiMessageParser();
    const msgs = parser.push(JSON.stringify({ deleteSurface: { surfaceId: 's1' } }) + '\n');
    expect(msgs).toHaveLength(1);
    expect('deleteSurface' in msgs[0]).toBe(true);
  });

  test('handles partial JSONL across pushes', () => {
    const parser = createA2uiMessageParser();
    const json = JSON.stringify({ beginRendering: { surfaceId: 's1', root: 'root' } });
    const half = Math.floor(json.length / 2);
    expect(parser.push(json.slice(0, half))).toEqual([]);
    const msgs = parser.push(json.slice(half) + '\n');
    expect(msgs).toHaveLength(1);
  });

  test('skips malformed lines silently', () => {
    const parser = createA2uiMessageParser();
    const msgs = parser.push('{not valid json}\n' + JSON.stringify({
      beginRendering: { surfaceId: 's1', root: 'root' },
    }) + '\n');
    expect(msgs).toHaveLength(1);
  });

  test('rejects unknown envelope keys', () => {
    const parser = createA2uiMessageParser();
    const msgs = parser.push(JSON.stringify({ unknownKey: { foo: 1 } }) + '\n');
    expect(msgs).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run — must FAIL**

```bash
npx nx test a2ui -t parser --skip-nx-cache 2>&1 | tail -10
```

- [ ] **Step 3: Rewrite the parser body**

Replace `libs/a2ui/src/lib/parser.ts`:

```ts
// SPDX-License-Identifier: MIT
import type { A2uiMessage } from './types.js';

const ENVELOPE_KEYS = ['surfaceUpdate', 'dataModelUpdate', 'beginRendering', 'deleteSurface'] as const;
type EnvelopeKey = typeof ENVELOPE_KEYS[number];

export interface A2uiMessageParser {
  push(chunk: string): A2uiMessage[];
}

export function createA2uiMessageParser(): A2uiMessageParser {
  let buffer = '';

  function parseEnvelope(json: Record<string, unknown>): A2uiMessage | null {
    for (const key of ENVELOPE_KEYS) {
      if (key in json && typeof json[key] === 'object' && json[key] !== null) {
        // Wrap the payload back under its key — A2uiMessage is a discriminated
        // union of single-key envelope objects.
        return { [key]: json[key] } as unknown as A2uiMessage;
      }
    }
    return null;
  }

  function push(chunk: string): A2uiMessage[] {
    buffer += chunk;
    const messages: A2uiMessage[] = [];

    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (!line) continue;

      try {
        const json = JSON.parse(line);
        if (json && typeof json === 'object' && !Array.isArray(json)) {
          const msg = parseEnvelope(json as Record<string, unknown>);
          if (msg) messages.push(msg);
        }
      } catch {
        // Skip malformed lines silently — partial JSONL is normal mid-stream.
      }
    }

    return messages;
  }

  return { push };
}
```

- [ ] **Step 4: Run — passes**

```bash
npx nx test a2ui -t parser --skip-nx-cache 2>&1 | tail -10
```

Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add libs/a2ui/src/lib/parser.ts libs/a2ui/src/lib/parser.spec.ts
git commit -m "feat(a2ui): parser eats v1 envelope keys"
```

### Task 1.3: Rewrite `libs/a2ui/src/lib/resolve.ts` for wrapped DynamicValue

**File:** `libs/a2ui/src/lib/resolve.ts` (currently 78 LOC)

`resolveDynamic` now receives wrapped values: `{literalString}` / `{literalNumber}` / `{literalBoolean}` / `{literalArray}` / `{path}`. v0.9 also supported `A2uiFunctionCall` (`{call, args}`); v1 schema in L4 doesn't show function calls — drop the function-call branch.

- [ ] **Step 1: Write the failing tests**

Replace `libs/a2ui/src/lib/resolve.spec.ts` with:

```ts
// SPDX-License-Identifier: MIT
import { describe, expect, test } from 'vitest';
import { resolveDynamic } from './resolve';

describe('resolveDynamic (v1)', () => {
  const model = { name: 'Brian', count: 7, active: true, tags: ['a', 'b'] };

  test('passes through bare literals (e.g. plain strings without wrappers)', () => {
    expect(resolveDynamic('hello', model)).toBe('hello');
    expect(resolveDynamic(42, model)).toBe(42);
    expect(resolveDynamic(null, model)).toBe(null);
  });

  test('unwraps literalString', () => {
    expect(resolveDynamic({ literalString: 'hello' }, model)).toBe('hello');
  });

  test('unwraps literalNumber', () => {
    expect(resolveDynamic({ literalNumber: 7 }, model)).toBe(7);
  });

  test('unwraps literalBoolean', () => {
    expect(resolveDynamic({ literalBoolean: true }, model)).toBe(true);
  });

  test('unwraps literalArray', () => {
    expect(resolveDynamic({ literalArray: ['x', 'y'] }, model)).toEqual(['x', 'y']);
  });

  test('resolves path against model', () => {
    expect(resolveDynamic({ path: '/name' }, model)).toBe('Brian');
    expect(resolveDynamic({ path: '/count' }, model)).toBe(7);
    expect(resolveDynamic({ path: '/missing' }, model)).toBe(undefined);
  });

  test('recurses into arrays', () => {
    const out = resolveDynamic([{ literalString: 'a' }, { path: '/name' }], model);
    expect(out).toEqual(['a', 'Brian']);
  });

  test('returns plain object passthrough for unrecognized shapes', () => {
    const obj = { id: 'x', children: ['a'] };
    expect(resolveDynamic(obj, model)).toEqual(obj);
  });

  test('relative path resolves against scope basePath', () => {
    expect(resolveDynamic({ path: 'name' }, model, { basePath: '', item: undefined })).toBe('Brian');
  });
});
```

- [ ] **Step 2: Run — must FAIL**

```bash
npx nx test a2ui -t resolve --skip-nx-cache 2>&1 | tail -10
```

- [ ] **Step 3: Rewrite resolve.ts**

Replace `libs/a2ui/src/lib/resolve.ts`:

```ts
// SPDX-License-Identifier: MIT
import { getByPointer } from './pointer.js';

export interface A2uiScope {
  basePath: string;
  item: unknown;
}

interface PathRef { path: string }
interface LiteralString { literalString: string }
interface LiteralNumber { literalNumber: number }
interface LiteralBoolean { literalBoolean: boolean }
interface LiteralArray { literalArray: unknown[] }

function isPathRef(v: unknown): v is PathRef {
  return typeof v === 'object' && v !== null && 'path' in v && typeof (v as PathRef).path === 'string';
}
function isLiteralString(v: unknown): v is LiteralString {
  return typeof v === 'object' && v !== null && 'literalString' in v;
}
function isLiteralNumber(v: unknown): v is LiteralNumber {
  return typeof v === 'object' && v !== null && 'literalNumber' in v;
}
function isLiteralBoolean(v: unknown): v is LiteralBoolean {
  return typeof v === 'object' && v !== null && 'literalBoolean' in v;
}
function isLiteralArray(v: unknown): v is LiteralArray {
  return typeof v === 'object' && v !== null && 'literalArray' in v;
}

function resolvePathRef(ref: PathRef, model: Record<string, unknown>, scope?: A2uiScope): unknown {
  const path = ref.path;
  if (path.startsWith('/')) return getByPointer(model, path);
  if (scope) return getByPointer(model, `${scope.basePath}/${path}`);
  return getByPointer(model, '/' + path);
}

export function resolveDynamic(
  value: unknown,
  model: Record<string, unknown>,
  scope?: A2uiScope,
): unknown {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(item => resolveDynamic(item, model, scope));

  // Literal wrappers — unwrap. Order matters less than mutual exclusivity.
  if (isLiteralString(value)) return value.literalString;
  if (isLiteralNumber(value)) return value.literalNumber;
  if (isLiteralBoolean(value)) return value.literalBoolean;
  if (isLiteralArray(value)) return value.literalArray;

  // Path reference
  if (isPathRef(value)) return resolvePathRef(value, model, scope);

  // Plain literal passthrough (string, number, boolean, plain object without wrappers)
  return value;
}
```

- [ ] **Step 4: Run — passes**

```bash
npx nx test a2ui -t resolve --skip-nx-cache 2>&1 | tail -10
```

- [ ] **Step 5: Update `libs/a2ui/src/lib/guards.ts`**

The existing guards file exports `isPathRef` / `isFunctionCall`. Replace with v1 guards:

```ts
// SPDX-License-Identifier: MIT
export function isPathRef(value: unknown): value is { path: string } {
  return typeof value === 'object' && value !== null
    && 'path' in value && typeof (value as { path: unknown }).path === 'string';
}

export function isLiteralString(value: unknown): value is { literalString: string } {
  return typeof value === 'object' && value !== null && 'literalString' in value;
}

export function isLiteralNumber(value: unknown): value is { literalNumber: number } {
  return typeof value === 'object' && value !== null && 'literalNumber' in value;
}

export function isLiteralBoolean(value: unknown): value is { literalBoolean: boolean } {
  return typeof value === 'object' && value !== null && 'literalBoolean' in value;
}
```

Update `libs/a2ui/src/lib/guards.spec.ts` accordingly:

```ts
// SPDX-License-Identifier: MIT
import { describe, expect, test } from 'vitest';
import { isPathRef, isLiteralString, isLiteralNumber, isLiteralBoolean } from './guards';

describe('a2ui v1 guards', () => {
  test('isPathRef', () => {
    expect(isPathRef({ path: '/x' })).toBe(true);
    expect(isPathRef({ literalString: 'x' })).toBe(false);
    expect(isPathRef(null)).toBe(false);
    expect(isPathRef('string')).toBe(false);
  });
  test('isLiteralString', () => {
    expect(isLiteralString({ literalString: 'x' })).toBe(true);
    expect(isLiteralString({ path: '/x' })).toBe(false);
  });
  test('isLiteralNumber', () => {
    expect(isLiteralNumber({ literalNumber: 7 })).toBe(true);
  });
  test('isLiteralBoolean', () => {
    expect(isLiteralBoolean({ literalBoolean: true })).toBe(true);
  });
});
```

- [ ] **Step 6: Delete the v0.9-only validation module**

The `libs/a2ui/src/lib/validate.ts` and `libs/a2ui/src/lib/validate.spec.ts` (CheckRule) are no longer used per spec decision 3. Delete them:

```bash
git rm libs/a2ui/src/lib/validate.ts libs/a2ui/src/lib/validate.spec.ts
```

Verify nothing in `libs/a2ui` still imports them:

```bash
grep -rn "evaluateCheckRules\|A2uiCheckRule\|A2uiValidationResult\|from.*validate" libs/a2ui/src/ libs/chat/src/lib/a2ui/
```

If anything in `libs/chat/src/lib/a2ui/` still imports from `./validate`, that'll be cleaned in Phase 2.

- [ ] **Step 7: `functions.ts` — drop function-call execution**

The v1 schema doesn't include `A2uiFunctionCall`. The existing `executeFunction` in `libs/a2ui/src/lib/functions.ts` is no longer called from `resolve.ts`. Two options:
- (a) Keep `executeFunction` exported as a utility with no internal consumers (YAGNI risk).
- (b) Delete it.

Choose **(b)** — delete `libs/a2ui/src/lib/functions.ts` and `libs/a2ui/src/lib/functions.spec.ts`:

```bash
git rm libs/a2ui/src/lib/functions.ts libs/a2ui/src/lib/functions.spec.ts
```

Update `libs/a2ui/src/index.ts` to remove the `executeFunction` export (already removed in Task 1.1 Step 4 if you followed that exactly; verify).

- [ ] **Step 8: Full a2ui test sweep**

```bash
npx nx test a2ui --skip-nx-cache 2>&1 | tail -15
```

Expected: All tests pass (types, parser, resolve, pointer, guards). Pointer tests should be unaffected.

- [ ] **Step 9: Build the lib**

```bash
npx nx build a2ui --skip-nx-cache 2>&1 | tail -10
```

Expected: build succeeds.

- [ ] **Step 10: Commit**

```bash
git add libs/a2ui/src/lib/resolve.ts libs/a2ui/src/lib/resolve.spec.ts libs/a2ui/src/lib/guards.ts libs/a2ui/src/lib/guards.spec.ts
git rm --cached libs/a2ui/src/lib/validate.ts libs/a2ui/src/lib/validate.spec.ts libs/a2ui/src/lib/functions.ts libs/a2ui/src/lib/functions.spec.ts 2>/dev/null || true
git commit -m "feat(a2ui): resolve + guards for wrapped DynamicValue; drop CheckRule + functions"
```

---

## Phase 2 — `libs/chat/src/lib/a2ui` adaptation

### Task 2.1: Rewrite `surface-store.ts` for deferred-apply on `beginRendering`

**File:** `libs/chat/src/lib/a2ui/surface-store.ts` (currently 78 LOC)

The store now buffers `surfaceUpdate` and `dataModelUpdate` per `surfaceId`. Calling `apply({ beginRendering: ... })` commits the buffered surface to the public map and emits a single change notification. `deleteSurface` clears both buffer and committed surface.

- [ ] **Step 1: Write failing tests**

Replace `libs/chat/src/lib/a2ui/surface-store.spec.ts` with:

```ts
// SPDX-License-Identifier: MIT
import { describe, expect, test } from 'vitest';
import { createA2uiSurfaceStore } from './surface-store';

describe('A2uiSurfaceStore (v1, deferred-apply)', () => {
  test('surfaceUpdate alone does not expose surface', () => {
    const store = createA2uiSurfaceStore();
    store.apply({
      surfaceUpdate: {
        surfaceId: 's1',
        components: [{ id: 'root', component: { Card: { child: 'inner' } } }],
      },
    });
    expect(store.surfaces().size).toBe(0);
  });

  test('beginRendering commits buffered surfaceUpdate', () => {
    const store = createA2uiSurfaceStore();
    store.apply({
      surfaceUpdate: {
        surfaceId: 's1',
        components: [{ id: 'root', component: { Card: { child: 'inner' } } }],
      },
    });
    store.apply({ beginRendering: { surfaceId: 's1', root: 'root' } });
    const surfaces = store.surfaces();
    expect(surfaces.size).toBe(1);
    const s = surfaces.get('s1');
    expect(s?.components.has('root')).toBe(true);
    expect(s?.dataModel).toEqual({});
  });

  test('beginRendering commits buffered dataModelUpdate too', () => {
    const store = createA2uiSurfaceStore();
    store.apply({
      surfaceUpdate: { surfaceId: 's1', components: [
        { id: 'root', component: { Text: { text: { path: '/title' } } } },
      ] },
    });
    store.apply({
      dataModelUpdate: {
        surfaceId: 's1',
        contents: [{ key: 'title', valueString: 'Hello' }],
      },
    });
    store.apply({ beginRendering: { surfaceId: 's1', root: 'root' } });
    const s = store.surfaces().get('s1');
    expect(s?.dataModel).toEqual({ title: 'Hello' });
  });

  test('post-render dataModelUpdate applies incrementally', () => {
    const store = createA2uiSurfaceStore();
    store.apply({ surfaceUpdate: { surfaceId: 's1', components: [
      { id: 'root', component: { Text: { text: { literalString: 'x' } } } },
    ] } });
    store.apply({ beginRendering: { surfaceId: 's1', root: 'root' } });
    store.apply({
      dataModelUpdate: { surfaceId: 's1', contents: [{ key: 'count', valueNumber: 7 }] },
    });
    expect(store.surfaces().get('s1')?.dataModel).toEqual({ count: 7 });
  });

  test('post-render surfaceUpdate replaces components atomically', () => {
    const store = createA2uiSurfaceStore();
    store.apply({ surfaceUpdate: { surfaceId: 's1', components: [
      { id: 'root', component: { Text: { text: { literalString: 'a' } } } },
    ] } });
    store.apply({ beginRendering: { surfaceId: 's1', root: 'root' } });
    store.apply({ surfaceUpdate: { surfaceId: 's1', components: [
      { id: 'root', component: { Text: { text: { literalString: 'b' } } } },
    ] } });
    // Without a second beginRendering, the new surfaceUpdate stays buffered.
    const root = store.surfaces().get('s1')?.components.get('root');
    expect((root?.component as { Text: { text: { literalString: string } } }).Text.text.literalString).toBe('a');
    store.apply({ beginRendering: { surfaceId: 's1', root: 'root' } });
    const root2 = store.surfaces().get('s1')?.components.get('root');
    expect((root2?.component as { Text: { text: { literalString: string } } }).Text.text.literalString).toBe('b');
  });

  test('deleteSurface clears both buffer and committed surface', () => {
    const store = createA2uiSurfaceStore();
    store.apply({ surfaceUpdate: { surfaceId: 's1', components: [
      { id: 'root', component: { Card: { child: 'inner' } } },
    ] } });
    store.apply({ beginRendering: { surfaceId: 's1', root: 'root' } });
    expect(store.surfaces().size).toBe(1);
    store.apply({ deleteSurface: { surfaceId: 's1' } });
    expect(store.surfaces().size).toBe(0);
  });

  test('dataModelUpdate before any surfaceUpdate is a no-op', () => {
    const store = createA2uiSurfaceStore();
    store.apply({
      dataModelUpdate: { surfaceId: 's1', contents: [{ key: 'name', valueString: 'B' }] },
    });
    store.apply({ beginRendering: { surfaceId: 's1', root: 'root' } });
    // No surfaceUpdate ever arrived; commit is a no-op.
    expect(store.surfaces().size).toBe(0);
  });
});
```

- [ ] **Step 2: Run — must FAIL**

```bash
npx nx test chat -t surface-store --skip-nx-cache 2>&1 | tail -10
```

- [ ] **Step 3: Rewrite surface-store.ts**

Replace `libs/chat/src/lib/a2ui/surface-store.ts`:

```ts
// SPDX-License-Identifier: MIT
import { computed, signal, type Signal } from '@angular/core';
import type {
  A2uiMessage, A2uiSurface, A2uiComponent,
  A2uiSurfaceUpdate, A2uiDataModelUpdate, A2uiBeginRendering, A2uiDeleteSurface,
  A2uiDataModelEntry,
} from '@ngaf/a2ui';
import { setByPointer } from '@ngaf/a2ui';

interface SurfaceBuffer {
  /** Pending component map (replaces on next beginRendering). */
  components?: Map<string, A2uiComponent>;
  /** Pending data model deltas accumulated since last beginRendering. */
  dataModelDeltas: { path?: string; contents: A2uiDataModelEntry[] }[];
}

export interface A2uiSurfaceStore {
  apply(message: A2uiMessage): void;
  readonly surfaces: Signal<Map<string, A2uiSurface>>;
  surface(surfaceId: string): Signal<A2uiSurface | undefined>;
}

function entriesToObject(entries: A2uiDataModelEntry[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const e of entries) {
    if ('valueString' in e && e.valueString !== undefined) out[e.key] = e.valueString;
    else if ('valueNumber' in e && e.valueNumber !== undefined) out[e.key] = e.valueNumber;
    else if ('valueBoolean' in e && e.valueBoolean !== undefined) out[e.key] = e.valueBoolean;
    else if ('valueMap' in e && Array.isArray(e.valueMap)) out[e.key] = entriesToObject(e.valueMap);
  }
  return out;
}

export function createA2uiSurfaceStore(): A2uiSurfaceStore {
  const surfacesSignal = signal<Map<string, A2uiSurface>>(new Map());
  const buffers = new Map<string, SurfaceBuffer>();

  function bufferOf(surfaceId: string): SurfaceBuffer {
    let b = buffers.get(surfaceId);
    if (!b) { b = { dataModelDeltas: [] }; buffers.set(surfaceId, b); }
    return b;
  }

  function apply(message: A2uiMessage): void {
    if ('surfaceUpdate' in message) {
      const upd = message.surfaceUpdate as A2uiSurfaceUpdate;
      const b = bufferOf(upd.surfaceId);
      const map = new Map<string, A2uiComponent>();
      for (const c of upd.components) map.set(c.id, c);
      b.components = map;
      return;
    }
    if ('dataModelUpdate' in message) {
      const upd = message.dataModelUpdate as A2uiDataModelUpdate;
      const b = bufferOf(upd.surfaceId);
      const surface = surfacesSignal().get(upd.surfaceId);
      if (surface) {
        // Already-rendered surface: apply incrementally.
        let dataModel = surface.dataModel;
        const obj = entriesToObject(upd.contents);
        if (upd.path && upd.path !== '/') {
          for (const [k, v] of Object.entries(obj)) {
            dataModel = setByPointer(dataModel, `${upd.path}/${k}`, v);
          }
        } else {
          dataModel = { ...dataModel, ...obj };
        }
        const next = new Map(surfacesSignal());
        next.set(upd.surfaceId, { ...surface, dataModel });
        surfacesSignal.set(next);
      } else {
        // Pre-render: buffer the delta.
        b.dataModelDeltas.push({ path: upd.path, contents: upd.contents });
      }
      return;
    }
    if ('beginRendering' in message) {
      const begin = message.beginRendering as A2uiBeginRendering;
      const b = buffers.get(begin.surfaceId);
      if (!b || !b.components) return; // no surfaceUpdate yet — no-op
      // Build initial data model from buffered deltas.
      let dataModel: Record<string, unknown> = {};
      for (const d of b.dataModelDeltas) {
        const obj = entriesToObject(d.contents);
        if (d.path && d.path !== '/') {
          for (const [k, v] of Object.entries(obj)) {
            dataModel = setByPointer(dataModel, `${d.path}/${k}`, v);
          }
        } else {
          dataModel = { ...dataModel, ...obj };
        }
      }
      const surface: A2uiSurface = {
        surfaceId: begin.surfaceId,
        catalogId: 'basic',
        components: b.components,
        dataModel,
      };
      // Merge with any existing surface's dataModel if this is a re-render.
      const existing = surfacesSignal().get(begin.surfaceId);
      if (existing) {
        surface.dataModel = { ...existing.dataModel, ...dataModel };
      }
      const next = new Map(surfacesSignal());
      next.set(begin.surfaceId, surface);
      surfacesSignal.set(next);
      // Reset buffer so subsequent surfaceUpdate is the next round.
      buffers.set(begin.surfaceId, { dataModelDeltas: [] });
      return;
    }
    if ('deleteSurface' in message) {
      const del = message.deleteSurface as A2uiDeleteSurface;
      buffers.delete(del.surfaceId);
      const next = new Map(surfacesSignal());
      next.delete(del.surfaceId);
      surfacesSignal.set(next);
      return;
    }
  }

  function surface(surfaceId: string): Signal<A2uiSurface | undefined> {
    return computed(() => surfacesSignal().get(surfaceId));
  }

  return { apply, surfaces: surfacesSignal.asReadonly(), surface };
}
```

- [ ] **Step 4: Run — passes**

```bash
npx nx test chat -t surface-store --skip-nx-cache 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/a2ui/surface-store.ts libs/chat/src/lib/a2ui/surface-store.spec.ts
git commit -m "feat(chat): a2ui surface-store buffers + commits on beginRendering"
```

### Task 2.2: Rewrite `surface-to-spec.ts` for v1 component shape

**File:** `libs/chat/src/lib/a2ui/surface-to-spec.ts` (currently 110 LOC)

The component is now `{ id, component: { Button: {...} } }` instead of `{ id, component: 'Button', label: '...', children: [...] }`. Action is `{ name, context: [...] }` not `{ event: { name, context } }`. Children always wrapped. Drop CheckRule support (`evaluateCheckRules` import gone).

- [ ] **Step 1: Replace surface-to-spec.ts**

```ts
// SPDX-License-Identifier: MIT
import type { Spec, UIElement } from '@json-render/core';
import type {
  A2uiSurface, A2uiComponent, A2uiAction, A2uiChildren,
  A2uiActionContextEntry,
} from '@ngaf/a2ui';
import { resolveDynamic, getByPointer, isPathRef } from '@ngaf/a2ui';

interface RenderedAction {
  click?: { action: string; params: Record<string, unknown> };
}

/** Pull the (single) component-type key + its props from a v1 ComponentDef wrapper. */
function unwrapComponentDef(def: A2uiComponent['component']): { type: string; props: Record<string, unknown> } {
  const entries = Object.entries(def);
  if (entries.length !== 1) {
    return { type: 'Text', props: {} };
  }
  const [type, props] = entries[0];
  return { type, props: (props ?? {}) as Record<string, unknown> };
}

function resolveAction(
  action: A2uiAction | undefined,
  surface: A2uiSurface,
  sourceComponentId: string,
): RenderedAction | undefined {
  if (!action) return undefined;
  const resolvedContext: Record<string, unknown> = {};
  if (Array.isArray(action.context)) {
    for (const entry of action.context as A2uiActionContextEntry[]) {
      resolvedContext[entry.key] = resolveDynamic(entry.value, surface.dataModel);
    }
  }
  return {
    click: {
      action: 'a2ui:event',
      params: {
        surfaceId: surface.surfaceId,
        sourceComponentId,
        name: action.name,
        context: resolvedContext,
      },
    },
  };
}

function childrenToList(
  children: A2uiChildren | undefined,
  surface: A2uiSurface,
): { ids: string[]; templateExpand?: { componentId: string; arrPath: string; arr: unknown[] } } | undefined {
  if (!children) return undefined;
  if ('explicitList' in children) {
    return { ids: children.explicitList };
  }
  if ('template' in children) {
    const t = children.template;
    const arr = getByPointer(surface.dataModel, t.dataBinding);
    if (!Array.isArray(arr)) return { ids: [] };
    const ids = arr.map((_, i) => `${t.componentId}__${i}`);
    return { ids, templateExpand: { componentId: t.componentId, arrPath: t.dataBinding, arr } };
  }
  return undefined;
}

const RESERVED_PROP_KEYS = new Set(['child', 'children', 'action']);

export function surfaceToSpec(surface: A2uiSurface): Spec | null {
  if (surface.components.size === 0) return null;

  const elements: Record<string, UIElement> = {};

  for (const [id, comp] of surface.components) {
    const { type, props: rawProps } = unwrapComponentDef(comp.component);

    const resolvedProps: Record<string, unknown> = {};
    const bindings: Record<string, string> = {};

    for (const [key, value] of Object.entries(rawProps)) {
      if (RESERVED_PROP_KEYS.has(key)) continue;
      if (isPathRef(value)) bindings[key] = value.path;
      resolvedProps[key] = resolveDynamic(value, surface.dataModel);
    }
    if (Object.keys(bindings).length > 0) {
      resolvedProps['_bindings'] = bindings;
    }

    const action = (rawProps as { action?: A2uiAction }).action;
    const on = resolveAction(action, surface, id);

    // Map children — handle Card single child, Modal entryPointChild + contentChild, Tabs tabItems
    let children: string[] | undefined;
    if (type === 'Card' && typeof (rawProps as { child?: unknown }).child === 'string') {
      children = [(rawProps as { child: string }).child];
    } else if (type === 'Button' && typeof (rawProps as { child?: unknown }).child === 'string') {
      children = [(rawProps as { child: string }).child];
    } else if (type === 'Modal') {
      const m = rawProps as { entryPointChild?: string; contentChild?: string };
      const ids: string[] = [];
      if (m.entryPointChild) ids.push(m.entryPointChild);
      if (m.contentChild) ids.push(m.contentChild);
      children = ids;
    } else if (type === 'Tabs') {
      const items = (rawProps as { tabItems?: { child: string }[] }).tabItems ?? [];
      children = items.map(t => t.child);
    } else {
      const childInfo = childrenToList((rawProps as { children?: A2uiChildren }).children, surface);
      if (childInfo) {
        children = childInfo.ids;
        if (childInfo.templateExpand) {
          const t = childInfo.templateExpand;
          const templateComp = surface.components.get(t.componentId);
          if (templateComp) {
            const { type: tType, props: tRaw } = unwrapComponentDef(templateComp.component);
            for (let i = 0; i < t.arr.length; i++) {
              const scope = { basePath: `${t.arrPath}/${i}`, item: t.arr[i] };
              const itemProps: Record<string, unknown> = {};
              for (const [k, v] of Object.entries(tRaw)) {
                if (RESERVED_PROP_KEYS.has(k)) continue;
                itemProps[k] = resolveDynamic(v, surface.dataModel, scope);
              }
              elements[`${t.componentId}__${i}`] = { type: tType, props: itemProps };
            }
          }
        }
      }
    }

    elements[id] = {
      type,
      props: resolvedProps,
      ...(children ? { children } : {}),
      ...(on ? { on } : {}),
    };
  }

  // Use `root` if present in the components map; otherwise prefer first id.
  const root = surface.components.has('root')
    ? 'root'
    : surface.components.keys().next().value as string;

  return { root, elements, state: surface.dataModel } as Spec;
}
```

- [ ] **Step 2: Update existing tests in `surface-to-spec.spec.ts`**

The existing spec file targets the v0.9 component shape. Replace tests to exercise v1: a Button-with-Text Card surface; a Column with explicitList children; a List with template + dataBinding; a Button with a context-bearing action. Use the v1 envelope shapes from `surface-store.spec.ts` as a template.

- [ ] **Step 3: Run — passes**

```bash
npx nx test chat -t surface-to-spec --skip-nx-cache 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add libs/chat/src/lib/a2ui/surface-to-spec.ts libs/chat/src/lib/a2ui/surface-to-spec.spec.ts
git commit -m "feat(chat): a2ui surface-to-spec unwraps v1 component-def shape"
```

### Task 2.3: Rewrite `build-action-message.ts` for v1 outbound action shape

**File:** `libs/chat/src/lib/a2ui/build-action-message.ts` (currently 28 LOC)

`A2uiActionMessage.action.context` is now `[{key, value: DynamicValue}]` (array of typed entries). Outbound construction wraps each value.

- [ ] **Step 1: Replace build-action-message.ts**

```ts
// SPDX-License-Identifier: MIT
import type { A2uiActionMessage, A2uiClientDataModel } from '@ngaf/a2ui';

function toDynamicValue(v: unknown): unknown {
  if (typeof v === 'string') return { literalString: v };
  if (typeof v === 'number') return { literalNumber: v };
  if (typeof v === 'boolean') return { literalBoolean: v };
  return { literalString: String(v) };
}

export function buildActionMessage(params: {
  surfaceId: string;
  sourceComponentId: string;
  name: string;
  context: Record<string, unknown>;
  clientDataModel?: A2uiClientDataModel;
}): A2uiActionMessage {
  return {
    version: 'v0.9',
    action: {
      name: params.name,
      surfaceId: params.surfaceId,
      sourceComponentId: params.sourceComponentId,
      timestamp: new Date().toISOString(),
      context: Object.fromEntries(
        Object.entries(params.context).map(([k, v]) => [k, toDynamicValue(v)]),
      ),
    },
    ...(params.clientDataModel ? { metadata: { a2uiClientDataModel: params.clientDataModel } } : {}),
  };
}
```

NOTE: `version: 'v0.9'` is intentionally retained — `A2uiActionMessage.version` is a string-literal type kept as `'v0.9'` for backward compat with the chat composition's `onA2uiAction` callback. Future PR can bump.

- [ ] **Step 2: Update tests in `build-action-message.spec.ts`**

Tests should assert `action.context.someKey` deserializes as `{literalString: 'value'}`, `{literalNumber: 7}`, etc.

- [ ] **Step 3: Run — passes**

```bash
npx nx test chat -t build-action-message --skip-nx-cache 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add libs/chat/src/lib/a2ui/build-action-message.ts libs/chat/src/lib/a2ui/build-action-message.spec.ts
git commit -m "feat(chat): a2ui build-action-message wraps context values as DynamicValue"
```

### Task 2.4: Update content-classifier wiring

**File:** `libs/chat/src/lib/streaming/content-classifier.ts`

The content classifier doesn't need protocol-shape changes — `A2UI_PREFIX` is unchanged, and the parser API surface (`createA2uiMessageParser().push()` returning `A2uiMessage[]` and the surface store's `apply(msg)`) is preserved. **Verify** the existing wiring still compiles after Phase 1+2 type changes.

- [ ] **Step 1: Build**

```bash
export PATH=/Users/blove/.nvm/versions/node/v22.14.0/bin:$PATH
npx nx run-many -t build,test,lint -p a2ui,chat --skip-nx-cache 2>&1 | tail -25
```

Expected: a2ui green, chat green. Any chat compilation errors here are spec-mismatch issues from Phase 1/2 — fix in place. Common issues:
- Old `evaluateCheckRules` / `validationResult` references in components → drop those props.
- Old `A2uiPathRef` import → swap to `isPathRef` from updated guards.

- [ ] **Step 2: Commit (if any wiring fixes)**

```bash
git add libs/chat/src/lib/
git commit -m "refactor(chat): align a2ui consumers with v1 type system"
```

---

## Phase 3 — Catalog component port (18 components)

Catalog batches share the same migration recipe. Each component:

1. Reads its property values from the v1 nested wrapper. The component's `surface-to-spec.ts` unwraps `component: { Button: {...} }` so the catalog component itself receives the inner props as Angular `input()`s — but the property *types* changed (always wrapped DynamicValue).
2. Replaces direct `[value]="text"` bindings with the resolved value: the `surface-to-spec.ts` already calls `resolveDynamic` on each prop, so the catalog component receives plain literals. **No catalog component should call `resolveDynamic` itself.**
3. Drops `validationResult` input (CheckRule no longer applies). Use `validationRegexp` per-component where present (TextField only).
4. `MultipleChoice` replaces `ChoicePicker` — file rename + select-mode logic for `maxAllowedSelections`.

**Generic recipe per component:**

| Old (v0.9) | New (v1) |
|---|---|
| `readonly text = input<string>('');` | `readonly text = input<string>('');` (still receives resolved literal — type unchanged at component level) |
| `readonly value = input<string>('');` | `readonly value = input<string>('');` (path-resolved upstream) |
| `readonly children = input<string[]>([]);` | unchanged — surface-to-spec emits a string[] children array regardless of v0.9/v1 wrapper shape |
| `readonly checks = input<A2uiCheckRule[]>([]);` | **REMOVE** |
| `readonly validationResult = input<A2uiValidationResult>(...);` | **REMOVE** |
| Card: `[children]="children"` rendering | Card: `[children]="children"` (children is now length-1 array containing the inner child id) |
| Button: `[label]="label"` displayed | Button: child Text component renders the label instead — Button's template is just the slot for the inner child + click handler |
| ChoicePicker | **RENAME**: file → `multiple-choice.component.ts`; selector → `a2ui-multiple-choice`; class → `A2uiMultipleChoiceComponent`; add `maxAllowedSelections` input + multi-select if `maxAllowedSelections > 1` |

### Task 3.1: Batch 1 — Media + Layout (9 components)

Files: `text`, `image`, `icon`, `video`, `audio-player`, `row`, `column`, `list`, `divider` `.component.ts` + their `.spec.ts`.

For each component:
- Drop `checks` / `validationResult` inputs.
- Verify `[children]` input still binds (surface-to-spec generates the string[]).
- Confirm any `[gap]`, `[distribution]`, `[alignment]`, `[direction]` props pass through as plain string enums (already plain strings in both v0.9 and v1).

Most components in this batch are nearly unchanged — they don't touch the wrapped DynamicValue shape directly because surface-to-spec resolves before passing.

- [ ] **Step 1: Audit each component for v0.9-only inputs**

```bash
grep -rn "checks\|validationResult\|A2uiCheckRule" libs/chat/src/lib/a2ui/catalog/{text,image,icon,video,audio-player,row,column,list,divider}.component.ts
```

Remove any matches.

- [ ] **Step 2: Run media + layout component tests**

```bash
npx nx test chat -t "text\|image\|icon\|video\|audio\|row\|column\|list\|divider" --skip-nx-cache 2>&1 | tail -15
```

Fix any test that still constructs v0.9-shape props in the spec setup.

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/lib/a2ui/catalog/{text,image,icon,video,audio-player,row,column,list,divider}.component*
git commit -m "refactor(chat): media + layout catalog batch — drop CheckRule props"
```

### Task 3.2: Batch 2 — Containers (3 components: Card, Tabs, Modal)

- [ ] **Step 1: Card — single child**

`libs/chat/src/lib/a2ui/catalog/card.component.ts` — change template/binding so the Card renders **one** child id, not an array. Update tests to pass a single-child spec.

The `surface-to-spec` already emits `children: [singleChildId]` when the v1 component is `{ Card: { child: 'inner' } }`, so the input shape `string[]` length-1 still works. Just update doc comment + spec.

- [ ] **Step 2: Tabs — `tabItems` instead of children list**

`libs/chat/src/lib/a2ui/catalog/tabs.component.ts` — Tabs now reads a `tabItems` input (array of `{title: DynamicString, child: string}`). The `title` is already resolved by surface-to-spec to a plain string. Update the template to iterate over `tabItems()`.

```ts
// catalog/tabs.component.ts (sketch)
readonly tabItems = input<{ title: string; child: string }[]>([]);
// drop the v0.9 `tabs` input if it existed
```

- [ ] **Step 3: Modal — `entryPointChild` + `contentChild`**

`libs/chat/src/lib/a2ui/catalog/modal.component.ts` — Modal now reads two inputs:

```ts
readonly entryPointChild = input<string>('');
readonly contentChild = input<string>('');
```

Surface-to-spec already emits `children: [entryPointChild, contentChild]`. Template projects each by index, OR Modal accepts the two ids and resolves children itself from a parent registry — match the existing implementation pattern.

- [ ] **Step 4: Run + commit**

```bash
npx nx test chat -t "card\|tabs\|modal" --skip-nx-cache 2>&1 | tail -15
git add libs/chat/src/lib/a2ui/catalog/{card,tabs,modal}.component*
git commit -m "refactor(chat): container catalog batch — Card single child, Tabs tabItems, Modal entryPoint+content"
```

### Task 3.3: Batch 3 — Inputs (5 components: Button, CheckBox, TextField, DateTimeInput, Slider)

- [ ] **Step 1: Button — child Text component**

`libs/chat/src/lib/a2ui/catalog/button.component.ts` — drop `[label]="label"` rendering; render the projected child via `[children]="children"` (length-1 with the Text child id). Surface-to-spec already emits `children: [buttonChildId]`. Add `[primary]="primary"` boolean input.

```ts
// Button (sketch)
readonly child = input<string>('');     // Or: receive via children input (string[])
readonly primary = input<boolean>(false);
// drop label input
```

- [ ] **Step 2: CheckBox — wrapped DynamicBoolean already resolved**

CheckBox's `value` input was a boolean in v0.9. Surface-to-spec resolves `{literalBoolean}`/`{path}` upstream, so the catalog component still sees a boolean — no change required to the input signature. Drop `checks` input. Verify spec passes.

- [ ] **Step 3: TextField — drop checks; add `validationRegexp`**

`libs/chat/src/lib/a2ui/catalog/text-field.component.ts` — drop `checks` / `validationResult` inputs. Add:

```ts
readonly validationRegexp = input<string | undefined>(undefined);
readonly textFieldType = input<'date'|'longText'|'number'|'shortText'|'obscured'>('shortText');
```

In the template, set `<input>`'s `type` from `textFieldType()` (`obscured` → `password`, `longText` → use textarea, `number` → `number`, `date` → `date`, default → `text`). Run validation against `validationRegexp` on input event; expose validity to consumers.

- [ ] **Step 4: DateTimeInput**

`libs/chat/src/lib/a2ui/catalog/date-time-input.component.ts` — drop CheckRule props; verify `enableDate`/`enableTime` boolean inputs already plain.

- [ ] **Step 5: Slider**

`libs/chat/src/lib/a2ui/catalog/slider.component.ts` — drop CheckRule props; `value` is a number (wrapped → resolved), `minValue`/`maxValue` already plain.

- [ ] **Step 6: Run + commit**

```bash
npx nx test chat -t "button\|checkbox\|text-field\|date-time\|slider" --skip-nx-cache 2>&1 | tail -15
git add libs/chat/src/lib/a2ui/catalog/{button,check-box,text-field,date-time-input,slider}.component*
git commit -m "refactor(chat): input catalog batch — Button child + primary, TextField validationRegexp + textFieldType"
```

### Task 3.4: New `MultipleChoice` component (replacing ChoicePicker)

- [ ] **Step 1: Create `libs/chat/src/lib/a2ui/catalog/multiple-choice.component.ts`**

```ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { emitBinding } from './emit-binding';

@Component({
  selector: 'a2ui-multiple-choice',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="a2ui-mc">
      @if (label()) {
        <label class="a2ui-mc__label">{{ label() }}</label>
      }
      @if (mode() === 'single') {
        <select class="a2ui-mc__select" (change)="onSelect($event)">
          @for (opt of options(); track opt.value) {
            <option [value]="opt.value" [selected]="selectedSet().has(opt.value)">
              {{ opt.label }}
            </option>
          }
        </select>
      } @else {
        <div class="a2ui-mc__group" role="group">
          @for (opt of options(); track opt.value) {
            <label class="a2ui-mc__option">
              <input
                type="checkbox"
                [value]="opt.value"
                [checked]="selectedSet().has(opt.value)"
                (change)="onToggle(opt.value, $event)"
              />
              {{ opt.label }}
            </label>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .a2ui-mc { display: flex; flex-direction: column; gap: 4px; }
    .a2ui-mc__select { padding: 6px 8px; border-radius: 6px; }
    .a2ui-mc__group { display: flex; flex-wrap: wrap; gap: 8px; }
    .a2ui-mc__option { display: inline-flex; align-items: center; gap: 4px; }
  `],
})
export class A2uiMultipleChoiceComponent {
  readonly label = input<string>('');
  readonly options = input<{ label: string; value: string }[]>([]);
  /** Resolved literal array (post resolve); from spec: DynamicStringList. */
  readonly selections = input<string[]>([]);
  readonly maxAllowedSelections = input<number | undefined>(undefined);
  readonly _bindings = input<Record<string, string>>({});
  readonly emit = input<(event: string) => void>(() => { /* noop */ });

  readonly mode = computed<'single' | 'multi'>(() =>
    (this.maxAllowedSelections() ?? Infinity) <= 1 ? 'single' : 'multi'
  );

  readonly selectedSet = computed(() => new Set(this.selections() ?? []));

  protected onSelect(event: Event): void {
    const v = (event.target as HTMLSelectElement).value;
    emitBinding(this.emit(), this._bindings(), 'selections', [v]);
  }

  protected onToggle(value: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const current = new Set(this.selections() ?? []);
    if (checked) {
      const max = this.maxAllowedSelections() ?? Infinity;
      if (current.size >= max) return; // ignore over-cap
      current.add(value);
    } else {
      current.delete(value);
    }
    emitBinding(this.emit(), this._bindings(), 'selections', [...current]);
  }
}
```

- [ ] **Step 2: Create matching spec file**

```ts
// libs/chat/src/lib/a2ui/catalog/multiple-choice.component.spec.ts
import { describe, expect, test } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { A2uiMultipleChoiceComponent } from './multiple-choice.component';

describe('A2uiMultipleChoiceComponent', () => {
  test('renders single-select select element when maxAllowedSelections=1', () => {
    const fixture = TestBed.createComponent(A2uiMultipleChoiceComponent);
    fixture.componentRef.setInput('options', [
      { label: 'A', value: 'a' }, { label: 'B', value: 'b' },
    ]);
    fixture.componentRef.setInput('selections', ['a']);
    fixture.componentRef.setInput('maxAllowedSelections', 1);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('select')).toBeTruthy();
  });

  test('renders checkbox group when maxAllowedSelections > 1 or undefined', () => {
    const fixture = TestBed.createComponent(A2uiMultipleChoiceComponent);
    fixture.componentRef.setInput('options', [
      { label: 'A', value: 'a' }, { label: 'B', value: 'b' },
    ]);
    fixture.componentRef.setInput('selections', []);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('input[type=checkbox]').length).toBe(2);
  });

  test('toggle respects maxAllowedSelections', () => {
    const fixture = TestBed.createComponent(A2uiMultipleChoiceComponent);
    let emittedEvent: string | undefined;
    fixture.componentRef.setInput('options', [
      { label: 'A', value: 'a' }, { label: 'B', value: 'b' }, { label: 'C', value: 'c' },
    ]);
    fixture.componentRef.setInput('selections', ['a', 'b']);
    fixture.componentRef.setInput('maxAllowedSelections', 2);
    fixture.componentRef.setInput('_bindings', { selections: '/picked' });
    fixture.componentRef.setInput('emit', (e: string) => { emittedEvent = e; });
    fixture.detectChanges();
    const checkboxes = fixture.nativeElement.querySelectorAll('input[type=checkbox]');
    // Try to toggle the third (would exceed cap)
    checkboxes[2].click();
    expect(emittedEvent).toBeUndefined();
  });
});
```

- [ ] **Step 3: Delete the old `choice-picker` component**

```bash
git rm libs/chat/src/lib/a2ui/catalog/choice-picker.component.ts
git rm libs/chat/src/lib/a2ui/catalog/choice-picker.component.spec.ts
```

- [ ] **Step 4: Update catalog index**

In `libs/chat/src/lib/a2ui/catalog/index.ts`:

```ts
// Replace:
import { A2uiChoicePickerComponent } from './choice-picker.component';
// ... in views map:
//   ChoicePicker: A2uiChoicePickerComponent,
// With:
import { A2uiMultipleChoiceComponent } from './multiple-choice.component';
// In views map:
//   MultipleChoice: A2uiMultipleChoiceComponent,
```

- [ ] **Step 5: Run + commit**

```bash
npx nx test chat -t multiple-choice --skip-nx-cache 2>&1 | tail -10
git add libs/chat/src/lib/a2ui/catalog/multiple-choice.component* libs/chat/src/lib/a2ui/catalog/index.ts
git rm --cached libs/chat/src/lib/a2ui/catalog/choice-picker.component* 2>/dev/null || true
git commit -m "feat(chat): MultipleChoice catalog component (replaces ChoicePicker)"
```

### Task 3.5: Full lib build + lint sweep

- [ ] **Step 1: Build everything**

```bash
export PATH=/Users/blove/.nvm/versions/node/v22.14.0/bin:$PATH
npx nx run-many -t build,test,lint -p a2ui,chat --skip-nx-cache 2>&1 | tail -25
```

Expected: all green. Fix any compile errors in place (likely from straggler v0.9 references in components or specs).

- [ ] **Step 2: Commit any final cleanup**

```bash
git status
git add -A
git commit -m "chore(chat): final v1 catalog cleanup"
```

---

## Phase 4 — Wiring verification

### Task 4.1: Confirm content-classifier and chat composition wire end-to-end

The classifier (`libs/chat/src/lib/streaming/content-classifier.ts`) auto-detects `---a2ui_JSON---` prefix and pushes lines into `createA2uiMessageParser` then `createA2uiSurfaceStore.apply`. Both APIs are unchanged at the surface level; verify by running the chat composition's spec.

- [ ] **Step 1: Run chat composition tests**

```bash
export PATH=/Users/blove/.nvm/versions/node/v22.14.0/bin:$PATH
npx nx test chat --skip-nx-cache 2>&1 | tail -15
```

Expected: all green.

- [ ] **Step 2: Build chat lib**

```bash
npx nx build chat --skip-nx-cache 2>&1 | tail -8
```

Expected: build succeeds.

- [ ] **Step 3: No commit needed if no changes — note phase 4 complete in dispatch report.**

---

## Phase 5 — `examples/chat/python/src/graph.py` FEEDBACK_FORM_JSONL rewrite

### Task 5.1: Replace `FEEDBACK_FORM_JSONL` with v1 envelope shape

**File:** `examples/chat/python/src/graph.py`

Locate the existing `FEEDBACK_FORM_JSONL = "\n".join([ ... ])` block (added in PR #226). Replace with the v1 shape from the spec:

- [ ] **Step 1: Replace the constant**

```python
FEEDBACK_FORM_JSONL = "\n".join([
    json.dumps({"surfaceUpdate": {
        "surfaceId": "feedback",
        "components": [
            {"id": "root", "component": {"Card": {"child": "main-column"}}},
            {"id": "main-column", "component": {"Column": {
                "children": {"explicitList": ["title", "name-field", "rating-picker", "submit-btn"]},
            }}},
            {"id": "title", "component": {"Text": {
                "text": {"literalString": "Quick feedback"},
                "usageHint": "h3",
            }}},
            {"id": "name-field", "component": {"TextField": {
                "label": {"literalString": "Your name"},
                "text": {"path": "/name"},
                "textFieldType": "shortText",
            }}},
            {"id": "rating-picker", "component": {"MultipleChoice": {
                "selections": {"path": "/rating"},
                "options": [
                    {"label": {"literalString": "1"}, "value": "1"},
                    {"label": {"literalString": "2"}, "value": "2"},
                    {"label": {"literalString": "3"}, "value": "3"},
                    {"label": {"literalString": "4"}, "value": "4"},
                    {"label": {"literalString": "5"}, "value": "5"},
                ],
                "maxAllowedSelections": 1,
            }}},
            {"id": "submit-btn-text", "component": {"Text": {
                "text": {"literalString": "Submit feedback"},
            }}},
            {"id": "submit-btn", "component": {"Button": {
                "child": "submit-btn-text",
                "primary": True,
                "action": {
                    "name": "feedbackSubmit",
                    "context": [
                        {"key": "surface", "value": {"literalString": "feedback"}},
                    ],
                },
            }}},
        ],
    }}),
    json.dumps({"dataModelUpdate": {
        "surfaceId": "feedback",
        "contents": [
            {"key": "name", "valueString": ""},
            {"key": "rating", "valueString": "5"},
        ],
    }}),
    json.dumps({"beginRendering": {
        "surfaceId": "feedback",
        "root": "root",
    }}),
]) + "\n"
```

- [ ] **Step 2: Run python smoke**

```bash
cd /Users/blove/repos/angular-agent-framework/examples/chat/python
uv run pytest -q -m smoke 2>&1 | tail -5
```

Expected: 11 passed (Phase 4's 3 new tests still relevant — they assert the prefix and envelope shape; the `createSurface` assertion in `test_a2ui_jsonl_starts_with_prefix_and_parses` needs updating to look for `surfaceUpdate` instead).

- [ ] **Step 3: Update the topology smoke test for v1 envelope check**

In `examples/chat/python/tests/test_graph_smoke.py`, locate `test_a2ui_jsonl_starts_with_prefix_and_parses`. Replace the assertion lines:

```python
    assert any("createSurface" in m for m in parsed)
    assert any("updateComponents" in m for m in parsed)
```

with:

```python
    assert any("surfaceUpdate" in m for m in parsed)
    assert any("beginRendering" in m for m in parsed)
```

- [ ] **Step 4: Re-run python smoke**

```bash
uv run pytest -q -m smoke 2>&1 | tail -5
```

Expected: 11 passed.

- [ ] **Step 5: Update `examples/chat/smoke/CHECKLIST.md` Generative UI section**

Locate the `## Generative UI / A2UI surfaces` section (populated in PR #226). Update the server-side assertion line that says:

> `curl localhost:2024/threads/<id>/state` shows: AI message with `tool_calls=[{ "name": "render_demo_form", ... }]`, ToolMessage with `content="rendered"`, AI message whose `content` starts with `---a2ui_JSON---\n`

Add or replace with:

```markdown
- [ ] Server-side: `curl localhost:2024/threads/<id>/state` shows AI message with tool_calls=[{ "name": "render_demo_form" }], ToolMessage with content="rendered", final AI message starts with `---a2ui_JSON---\n` and contains `surfaceUpdate` + `dataModelUpdate` + `beginRendering` envelopes (v1 shape; v0.9 envelope keys gone).
```

- [ ] **Step 6: Commit**

```bash
cd /Users/blove/repos/angular-agent-framework
git add examples/chat/python/src/graph.py examples/chat/python/tests/test_graph_smoke.py examples/chat/smoke/CHECKLIST.md
git commit -m "feat(examples-chat-python): port FEEDBACK_FORM_JSONL to A2UI v1 envelopes"
```

---

## Phase 6 — Verification + PR (controller-driven)

### Task 6.1: Full local sweep across the lib stack

- [ ] **Step 1: Lib unit tests**

```bash
cd /Users/blove/repos/angular-agent-framework
export PATH=/Users/blove/.nvm/versions/node/v22.14.0/bin:$PATH
npx nx run-many -t test,lint,build -p a2ui,chat,examples-chat-angular --skip-nx-cache 2>&1 | tail -25
```

Expected: all green.

- [ ] **Step 2: Python smoke**

```bash
npx nx run examples-chat-python:smoke --skip-nx-cache 2>&1 | tail -3
```

Expected: 11 passed.

- [ ] **Step 3: Regenerate API docs**

```bash
npm run generate-api-docs 2>&1 | tail -8
git diff --stat apps/website/content/docs/
```

If any `api-docs.json` changed (likely chat from MultipleChoice + dropped CheckRule):

```bash
git add apps/website/content/docs/
git commit -m "docs: regenerate API docs after a2ui v1 migration"
```

- [ ] **Step 4: Server-side end-to-end probe**

Confirm `OPENAI_API_KEY` in `examples/chat/python/.env`. Start backend:

```bash
nohup uv run --directory /Users/blove/repos/angular-agent-framework/examples/chat/python langgraph dev --port 2024 --no-browser > /tmp/exchat-py-v1.log 2>&1 &
```

Wait for ready, then probe:

```bash
tid=$(curl -sf -X POST -H 'Content-Type: application/json' http://localhost:2024/threads -d '{}' | python3 -c "import sys,json;print(json.load(sys.stdin)['thread_id'])")
echo "thread=$tid"
curl -sf -X POST -H 'Content-Type: application/json' "http://localhost:2024/threads/$tid/runs/wait" \
  -d '{"assistant_id":"chat","input":{"messages":[{"role":"user","content":"Use the render_demo_form tool to show me a feedback card with name and rating fields."}],"model":"gpt-5-mini"}}' \
  > /tmp/v1-final.json
python3 << 'EOF'
import json
d = json.load(open('/tmp/v1-final.json'))
msgs = d.get('messages', []) if isinstance(d, dict) else []
final_ai = [m for m in msgs if m.get('type') == 'ai' and not m.get('tool_calls')]
for ai in final_ai[-1:]:
    c = ai.get('content', '')
    text = c if isinstance(c, str) else next((b.get('text','') for b in c if isinstance(b, dict) and b.get('type')=='text'), '')
    print('starts with prefix:', text.startswith('---a2ui_JSON---'))
    has_v1 = 'surfaceUpdate' in text and 'beginRendering' in text
    has_v09 = 'createSurface' in text or 'updateComponents' in text
    print('contains v1 envelopes:', has_v1)
    print('contains v0.9 envelopes (should be False):', has_v09)
    print('first 240 chars:', repr(text[:240]))
EOF
```

Expected: `starts with prefix: True`, `contains v1 envelopes: True`, `contains v0.9 envelopes (should be False): False`.

### Task 6.2: LIVE Chrome MCP smoke

Per spec, exercise the demo end-to-end against the migrated lib + ported demo.

- [ ] **Step 1: Start Angular dev server (workspace-linked libs pick up the migration)**

```bash
export PATH=/Users/blove/.nvm/versions/node/v22.14.0/bin:$PATH
nohup npx nx serve examples-chat-angular > /tmp/exchat-ng-v1.log 2>&1 &
```

Wait for `:4200` to be reachable.

- [ ] **Step 2: Open Chrome tab to /embed**

Use Chrome MCP `tabs_context_mcp` + `navigate` to load `http://localhost:4200/embed` in tab 189619275 (or create a new tab).

- [ ] **Step 3: Click "New conversation" then the A2UI welcome suggestion**

```js
(async()=>{
  const reset=Array.from(document.querySelectorAll('button')).find(b=>b.innerText.includes('New conversation'));
  reset?.click();
  await new Promise(r=>setTimeout(r,800));
  const t=Array.from(document.querySelectorAll('button')).find(b=>b.innerText.includes('A2UI surface'));
  t.click();
  return 'kicked';
})()
```

- [ ] **Step 4: Wait ~18s for the surface to mount**

Use Monitor with `until [ $SECONDS -gt 18 ]; do sleep 3; done; echo TIMER`.

- [ ] **Step 5: Verify the surface, components, and v1-only envelope content**

```js
(()=>{
  const sf=document.querySelector('a2ui-surface');
  const titles=Array.from(document.querySelectorAll('a2ui-surface .title,a2ui-surface h2,a2ui-surface h3')).map(e=>e.innerText.substring(0,40));
  const subtree=[...new Set(Array.from(document.querySelectorAll('a2ui-surface *')).map(e=>e.tagName.toLowerCase()).filter(t=>t.includes('-')))];
  const buttons=Array.from(document.querySelectorAll('a2ui-surface button')).map(b=>b.innerText.substring(0,30));
  const inputs=Array.from(document.querySelectorAll('a2ui-surface input,a2ui-surface select')).map(i=>({name:i.name||i.placeholder||i.id,type:i.type,tag:i.tagName}));
  const shell=document.querySelector('demo-shell');
  const agent=ng.getComponent(shell)?.agent;
  const lastMsg=agent?.messages?.()?.at?.(-1);
  const lastContent=typeof lastMsg?.content==='string'?lastMsg.content:JSON.stringify(lastMsg?.content||'');
  return {
    surface:!!sf,
    titles,
    subtree,
    buttons,
    inputs,
    msgs:document.querySelectorAll('chat-message').length,
    contentStartsWithPrefix:lastContent.startsWith('---a2ui_JSON---'),
    containsSurfaceUpdate:lastContent.includes('"surfaceUpdate"'),
    containsBeginRendering:lastContent.includes('"beginRendering"'),
    containsV09Envelopes:lastContent.includes('"createSurface"')||lastContent.includes('"updateComponents"'),
  };
})()
```

Expected:
- `surface: true`
- `titles` contains `'Quick feedback'`
- `subtree` includes `a2ui-card`, `a2ui-text-field`, `a2ui-multiple-choice`, `a2ui-button`
- `buttons` contains `'Submit feedback'`
- `inputs` contains a TextField input + a SELECT (or checkbox group, depending on `maxAllowedSelections=1` mode picked by the component)
- `containsSurfaceUpdate: true`
- `containsBeginRendering: true`
- `containsV09Envelopes: false`

If the multiple-choice component renders as checkboxes when `maxAllowedSelections=1` (the spec says ≤1 → 'single' mode → SELECT), update either the JSONL (use `maxAllowedSelections: 1`) or the component logic.

- [ ] **Step 6: Action round-trip — fill the form via JS data model + click Submit; verify AI conversational reply**

```js
(async()=>{
  // Set name + rating via direct input (or JS dataModel hack — Finding K still pending)
  const sf=document.querySelector('a2ui-surface');
  const c=ng.getComponent(sf);
  // ... fill via input events or direct dataModel mutation
  const btn=Array.from(document.querySelectorAll('a2ui-surface button')).find(b=>b.innerText.includes('Submit'));
  btn.click();
  await new Promise(r=>setTimeout(r,15000));
  const last=document.querySelectorAll('chat-message');
  return {msgs:last.length, lastTxt:last[last.length-1]?.innerText?.substring(0,300)};
})()
```

Expected: msg count increases (action round-trip submitted as a new user message); AI replies referencing the form.

(Finding K — datamodel back-prop — is still open; if Submit is disabled because of empty name, click via JS bypassing the disabled state OR seed dataModel directly. Document any datamodel-binding gaps but do not block the merge on Finding K.)

- [ ] **Step 7: Capture final state + tear down**

Stop the backend and Angular dev server:

```bash
pkill -f "langgraph dev" 2>/dev/null
pkill -f "nx serve" 2>/dev/null
sleep 1
lsof -nP -iTCP:2024,4200 -sTCP:LISTEN 2>&1 | head -4
```

Expected: nothing listening.

### Task 6.3: Push + open PR

- [ ] **Step 1: Push**

```bash
git push -u origin claude/a2ui-v1-migration 2>&1 | tail -3
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "feat(a2ui): migrate to canonical v1 protocol" --body "$(cat <<'EOF'
## Summary

Migrates \`@ngaf/a2ui\` from the older v0.9 envelope shape (\`createSurface\`/\`updateComponents\`/\`updateDataModel\`) to the canonical Google A2UI v1 protocol (\`surfaceUpdate\`/\`dataModelUpdate\`/\`beginRendering\`/\`deleteSurface\`). Single PR, no backward compat — the lib was unreleased internally.

Forcing function for the canonical examples/chat demo's Phase 5 (GenUI dropdown + dynamic schema generation via sub-LLM): the sub-LLM's system prompt becomes the canonical v1 schema, so the parser must eat what the schema docs describe.

### Wire-format diff

- Envelopes: \`createSurface\`/\`updateComponents\`/\`updateDataModel\` → \`surfaceUpdate\`/\`dataModelUpdate\`; new \`beginRendering\` commit point.
- Components: flat → type-keyed wrapper (\`{component: {Button: {...}}}\`).
- Dynamic values: bare literals & \`{path}\` → always wrapped (\`{literalString}\`/\`{literalNumber}\`/\`{literalBoolean}\`/\`{path}\`).
- Children: \`string[]\` or template object → \`{explicitList}\`/\`{template}\` always wrapped.
- Action: \`{event: {name, context}}\` → \`{name, context: [{key, value: DynamicValue}]}\`.
- \`Card.children\` (array) → \`Card.child\` (single).
- \`Button.label\` → child \`Text\` component referenced via \`Button.child\`.
- \`ChoicePicker\` → \`MultipleChoice\` with \`selections\`/\`maxAllowedSelections\`.

### Decisions
- No backward compat (clean cutover).
- Deferred-apply on \`beginRendering\` (atomic commit; eliminates partial-render flicker).
- Dropped \`CheckRule\` validation extension — use \`TextField.validationRegexp\` instead.
- Renamed \`ChoicePicker\` → \`MultipleChoice\` to match v1 spec.
- Skipped new v1 components (Heading, etc.) — keep catalog at 18, follow-up adds v1 additions.

Spec: \`docs/superpowers/specs/2026-05-09-a2ui-v1-protocol-migration-design.md\`
Plan: \`docs/superpowers/plans/2026-05-09-a2ui-v1-protocol-migration.md\`

## Test plan

### Verified locally
- [x] \`nx run-many -t test,lint,build -p a2ui,chat,examples-chat-angular\` — all green
- [x] \`nx run examples-chat-python:smoke\` — 11 passed
- [x] **Server-side end-to-end probe**: render_demo_form tool_call → ToolMessage("rendered") → final AIMessage starts with \`---a2ui_JSON---\\n\` and contains \`surfaceUpdate\` + \`beginRendering\` envelopes (v1); contains no \`createSurface\`/\`updateComponents\` (v0.9 cleanly removed).
- [x] **Live Chrome MCP smoke** at \`/embed\`: click "Demo: render an interactive A2UI surface" → \`<a2ui-surface>\` mounts the Card titled "Quick feedback" with TextField + MultipleChoice + Submit Button. Final AIMessage content contains v1 envelopes only.

### Pending visual verification
- [ ] After merge: live smoke against the workspace examples/chat demo across /embed, /popup, /sidebar.

### Open follow-ups
- Finding K (Phase 4): A2UI text-field emits \`a2ui:datamodel:*\` events with no consumer wired up; form input doesn't back-propagate. Orthogonal lib gap, separate PR.
- New v1 components (Heading, etc.) — separate enhancement PR.
- \`A2uiTheme\` migration to \`beginRendering.styles\` — separate enhancement PR.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" 2>&1 | tail -3
```

- [ ] **Step 3: Note the PR URL**

- [ ] **Step 4: Wait for CI; address failures**

- [ ] **Step 5: Merge once green**

---

## Definition of done

1. PR merged.
2. CI green: lib tests + lint + build for `a2ui` and `chat`; python smoke 11 passed; examples-chat-angular lint/build/test.
3. Server-side probe confirms: AI tool_call → ToolMessage("rendered") → final AIMessage starts with `---a2ui_JSON---\n` and contains v1 envelopes only (`surfaceUpdate`/`dataModelUpdate`/`beginRendering`); no v0.9 envelope keys (`createSurface`/`updateComponents`) remain.
4. Live Chrome MCP smoke confirms: `<a2ui-surface>` renders the Card with v1 catalog components (TextField + MultipleChoice + Button); final AI message content contains v1 envelopes only.
5. CHECKLIST.md updated to reference v1 envelope assertion.
6. API docs regenerated.
