# Streaming Generative UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-detect and render generative UI content (json-render Spec, markdown) from AI message streams with character-level streaming and element-level memoization.

**Architecture:** A new standalone `@cacheplane/partial-json` library provides tree-based streaming JSON parsing. The render lib gets element-level `computed()` equality for memoization. The chat lib gains a `ContentClassifier` that detects content type and routes to the partial JSON parser or markdown accumulator, plus a `ParseTreeStore` that bridges parse tree events to structurally-shared `Spec` signals. The `ChatComponent` template switches from markdown-only to classified rendering.

**Tech Stack:** Angular 20+ signals, Vitest, TypeScript, `@json-render/core` (Spec types), Nx monorepo

---

## File Structure

### New Library: `libs/partial-json/`

| File | Responsibility |
|------|---------------|
| `src/index.ts` | Public API barrel |
| `src/lib/types.ts` | Node types, ParseEvent, parser interface |
| `src/lib/parser.ts` | Character-by-character state machine parser |
| `src/lib/parser.spec.ts` | Parser unit tests |
| `src/lib/materialize.ts` | Tree → plain JS with structural sharing |
| `src/lib/materialize.spec.ts` | Materialization + structural sharing tests |
| `project.json` | Nx project config |
| `package.json` | NPM metadata |
| `tsconfig.json` | TS config |
| `tsconfig.lib.json` | Lib build config |
| `vite.config.mts` | Vitest config |

### Modified: `libs/render/`

| File | Change |
|------|--------|
| `src/lib/render-element.component.ts` | Add `{ equal: Object.is }` to `element()` computed |
| `src/lib/render-element.component.spec.ts` | Add memoization test |

### New/Modified: `libs/chat/`

| File | Responsibility |
|------|---------------|
| `src/lib/streaming/content-classifier.ts` | Content type detection + routing (NEW) |
| `src/lib/streaming/content-classifier.spec.ts` | Classifier tests (NEW) |
| `src/lib/streaming/parse-tree-store.ts` | Bridges parser → Spec signal (NEW) |
| `src/lib/streaming/parse-tree-store.spec.ts` | Store tests (NEW) |
| `src/lib/compositions/chat/chat.component.ts` | Template + classifier lifecycle (MODIFY) |
| `src/lib/compositions/chat/chat.component.spec.ts` | Integration tests (MODIFY) |
| `src/public-api.ts` | Export new types (MODIFY) |

---

### Task 1: Scaffold `@cacheplane/partial-json` Library

**Files:**
- Create: `libs/partial-json/project.json`
- Create: `libs/partial-json/package.json`
- Create: `libs/partial-json/tsconfig.json`
- Create: `libs/partial-json/tsconfig.lib.json`
- Create: `libs/partial-json/vite.config.mts`
- Create: `libs/partial-json/src/index.ts`
- Modify: `tsconfig.base.json`

- [ ] **Step 1: Create project.json**

```json
{
  "name": "partial-json",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/partial-json/src",
  "projectType": "library",
  "tags": ["scope:shared", "type:lib"],
  "targets": {
    "build": {
      "executor": "@nx/js:tsc",
      "outputs": ["{workspaceRoot}/dist/libs/partial-json"],
      "options": {
        "outputPath": "dist/libs/partial-json",
        "main": "libs/partial-json/src/index.ts",
        "tsConfig": "libs/partial-json/tsconfig.lib.json"
      }
    },
    "lint": {
      "executor": "@nx/eslint:lint"
    },
    "test": {
      "executor": "@nx/vite:test",
      "options": {
        "configFile": "libs/partial-json/vite.config.mts"
      }
    }
  }
}
```

- [ ] **Step 2: Create package.json**

```json
{
  "name": "@cacheplane/partial-json",
  "version": "0.0.1",
  "license": "PolyForm-Noncommercial-1.0.0",
  "sideEffects": false
}
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "files": [],
  "references": [
    { "path": "./tsconfig.lib.json" }
  ]
}
```

- [ ] **Step 4: Create tsconfig.lib.json**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc",
    "declaration": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.spec.ts"]
}
```

- [ ] **Step 5: Create vite.config.mts**

```ts
import { defineConfig } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export default defineConfig({
  plugins: [nxViteTsPaths()],
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.spec.ts'],
  },
});
```

- [ ] **Step 6: Create src/index.ts (empty barrel)**

```ts
// Public API — populated as modules are added
```

- [ ] **Step 7: Add path mapping to tsconfig.base.json**

Add to `compilerOptions.paths`:

```json
"@cacheplane/partial-json": ["libs/partial-json/src/index.ts"]
```

- [ ] **Step 8: Verify the scaffold compiles**

Run: `npx nx test partial-json`
Expected: PASS (no tests, passWithNoTests is the vitest default via globals)

- [ ] **Step 9: Commit**

```bash
git add libs/partial-json/ tsconfig.base.json
git commit -m "chore: scaffold @cacheplane/partial-json library"
```

---

### Task 2: Partial JSON Parser — Types

**Files:**
- Create: `libs/partial-json/src/lib/types.ts`
- Modify: `libs/partial-json/src/index.ts`

- [ ] **Step 1: Write the types file**

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/** Kinds of JSON values a node can represent. */
export type JsonNodeType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';

/** Parsing state of a node. */
export type JsonNodeStatus = 'pending' | 'streaming' | 'complete';

/** Base shape shared by all nodes. */
export interface JsonNodeBase {
  /** Stable identity — assigned on creation, never changes. */
  readonly id: number;
  /** What kind of JSON value this node represents. */
  readonly type: JsonNodeType;
  /** Parsing state. */
  status: JsonNodeStatus;
  /** Parent node (null for root). */
  parent: JsonNode | null;
  /** Key in parent — string for object properties, number for array indices. */
  key: string | number | null;
}

export interface JsonObjectNode extends JsonNodeBase {
  readonly type: 'object';
  children: Map<string, JsonNode>;
  /** Key currently being built (between quote open and colon). */
  pendingKey: string | null;
}

export interface JsonArrayNode extends JsonNodeBase {
  readonly type: 'array';
  children: JsonNode[];
}

export interface JsonStringNode extends JsonNodeBase {
  readonly type: 'string';
  /** Grows character-by-character as tokens arrive. */
  value: string;
}

export interface JsonNumberNode extends JsonNodeBase {
  readonly type: 'number';
  /** Raw characters accumulated so far. */
  raw: string;
  /** Parsed value — set when node completes. */
  value: number | null;
}

export interface JsonBooleanNode extends JsonNodeBase {
  readonly type: 'boolean';
  value: boolean;
}

export interface JsonNullNode extends JsonNodeBase {
  readonly type: 'null';
}

export type JsonNode =
  | JsonObjectNode
  | JsonArrayNode
  | JsonStringNode
  | JsonNumberNode
  | JsonBooleanNode
  | JsonNullNode;

/** Events emitted by the parser as the tree changes. */
export interface ParseEvent {
  type: 'node-created' | 'value-updated' | 'node-completed';
  node: JsonNode;
  /** For value-updated on strings: the characters appended this push. */
  delta?: string;
}

/** Push-based streaming JSON parser. */
export interface PartialJsonParser {
  /** Feed characters. Returns events for what changed. */
  push(chunk: string): ParseEvent[];
  /** Root node of the parse tree. */
  readonly root: JsonNode | null;
  /** Look up a node by JSON Pointer path (e.g., "/elements/el-1/props"). */
  getByPath(path: string): JsonNode | null;
}
```

- [ ] **Step 2: Update barrel export**

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
export type {
  JsonNodeType, JsonNodeStatus, JsonNodeBase,
  JsonObjectNode, JsonArrayNode, JsonStringNode,
  JsonNumberNode, JsonBooleanNode, JsonNullNode,
  JsonNode, ParseEvent, PartialJsonParser,
} from './lib/types';
```

- [ ] **Step 3: Verify types compile**

Run: `npx nx test partial-json`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add libs/partial-json/
git commit -m "feat(partial-json): add node types and parser interface"
```

---

### Task 3: Partial JSON Parser — State Machine

**Files:**
- Create: `libs/partial-json/src/lib/parser.ts`
- Create: `libs/partial-json/src/lib/parser.spec.ts`
- Modify: `libs/partial-json/src/index.ts`

- [ ] **Step 1: Write failing tests for core parsing**

Create `libs/partial-json/src/lib/parser.spec.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { createPartialJsonParser } from './parser';

describe('createPartialJsonParser', () => {
  describe('strings', () => {
    it('parses a complete string', () => {
      const parser = createPartialJsonParser();
      parser.push('"hello"');
      expect(parser.root).not.toBeNull();
      expect(parser.root!.type).toBe('string');
      expect((parser.root as any).value).toBe('hello');
      expect(parser.root!.status).toBe('complete');
    });

    it('streams a string character-by-character', () => {
      const parser = createPartialJsonParser();
      parser.push('"he');
      expect(parser.root!.type).toBe('string');
      expect((parser.root as any).value).toBe('he');
      expect(parser.root!.status).toBe('streaming');

      parser.push('llo"');
      expect((parser.root as any).value).toBe('hello');
      expect(parser.root!.status).toBe('complete');
    });

    it('emits value-updated events with delta for strings', () => {
      const parser = createPartialJsonParser();
      const events1 = parser.push('"he');
      // Should have node-created + value-updated
      const created = events1.find(e => e.type === 'node-created');
      expect(created).toBeDefined();

      const events2 = parser.push('llo"');
      const updated = events2.find(e => e.type === 'value-updated');
      expect(updated).toBeDefined();
      expect(updated!.delta).toBe('llo');
    });

    it('handles escaped characters in strings', () => {
      const parser = createPartialJsonParser();
      parser.push('"hello\\nworld"');
      expect((parser.root as any).value).toBe('hello\nworld');
    });

    it('handles escaped quotes in strings', () => {
      const parser = createPartialJsonParser();
      parser.push('"say \\"hi\\""');
      expect((parser.root as any).value).toBe('say "hi"');
    });

    it('handles unicode escapes', () => {
      const parser = createPartialJsonParser();
      parser.push('"\\u0041"');
      expect((parser.root as any).value).toBe('A');
    });
  });

  describe('numbers', () => {
    it('parses an integer', () => {
      const parser = createPartialJsonParser();
      parser.push('42');
      expect(parser.root!.type).toBe('number');
      // Number is still streaming (no terminator seen)
      expect((parser.root as any).raw).toBe('42');
    });

    it('completes a number when followed by comma or brace', () => {
      const parser = createPartialJsonParser();
      parser.push('[42]');
      const arr = parser.root as any;
      expect(arr.type).toBe('array');
      expect(arr.children[0].type).toBe('number');
      expect(arr.children[0].value).toBe(42);
      expect(arr.children[0].status).toBe('complete');
    });

    it('parses negative and decimal numbers', () => {
      const parser = createPartialJsonParser();
      parser.push('[-3.14]');
      const arr = parser.root as any;
      expect(arr.children[0].value).toBe(-3.14);
    });
  });

  describe('booleans and null', () => {
    it('parses true', () => {
      const parser = createPartialJsonParser();
      parser.push('true');
      expect(parser.root!.type).toBe('boolean');
      expect((parser.root as any).value).toBe(true);
    });

    it('parses false', () => {
      const parser = createPartialJsonParser();
      parser.push('false');
      expect(parser.root!.type).toBe('boolean');
      expect((parser.root as any).value).toBe(false);
    });

    it('parses null', () => {
      const parser = createPartialJsonParser();
      parser.push('null');
      expect(parser.root!.type).toBe('null');
    });

    it('handles partial keywords gracefully', () => {
      const parser = createPartialJsonParser();
      parser.push('tru');
      // Should be pending/streaming, not errored
      expect(parser.root).not.toBeNull();
    });
  });

  describe('objects', () => {
    it('parses a simple object', () => {
      const parser = createPartialJsonParser();
      parser.push('{"name":"Alice"}');
      expect(parser.root!.type).toBe('object');
      const obj = parser.root as any;
      expect(obj.children.get('name').type).toBe('string');
      expect(obj.children.get('name').value).toBe('Alice');
      expect(obj.status).toBe('complete');
    });

    it('streams an object property value', () => {
      const parser = createPartialJsonParser();
      parser.push('{"name":"Al');
      const obj = parser.root as any;
      expect(obj.children.get('name').value).toBe('Al');
      expect(obj.children.get('name').status).toBe('streaming');

      parser.push('ice"}');
      expect(obj.children.get('name').value).toBe('Alice');
      expect(obj.children.get('name').status).toBe('complete');
    });

    it('parses multiple properties', () => {
      const parser = createPartialJsonParser();
      parser.push('{"a":1,"b":2}');
      const obj = parser.root as any;
      expect(obj.children.get('a').value).toBe(1);
      expect(obj.children.get('b').value).toBe(2);
    });

    it('parses nested objects', () => {
      const parser = createPartialJsonParser();
      parser.push('{"outer":{"inner":"val"}}');
      const obj = parser.root as any;
      const inner = obj.children.get('outer');
      expect(inner.type).toBe('object');
      expect(inner.children.get('inner').value).toBe('val');
    });
  });

  describe('arrays', () => {
    it('parses a simple array', () => {
      const parser = createPartialJsonParser();
      parser.push('[1,2,3]');
      const arr = parser.root as any;
      expect(arr.type).toBe('array');
      expect(arr.children.length).toBe(3);
      expect(arr.children[0].value).toBe(1);
      expect(arr.children[2].value).toBe(3);
    });

    it('parses array of strings', () => {
      const parser = createPartialJsonParser();
      parser.push('["a","b"]');
      const arr = parser.root as any;
      expect(arr.children[0].value).toBe('a');
      expect(arr.children[1].value).toBe('b');
    });

    it('parses nested arrays', () => {
      const parser = createPartialJsonParser();
      parser.push('[[1,2],[3]]');
      const arr = parser.root as any;
      expect(arr.children.length).toBe(2);
      expect(arr.children[0].children[1].value).toBe(2);
    });
  });

  describe('streaming complex structures', () => {
    it('builds a Spec-like structure token-by-token', () => {
      const parser = createPartialJsonParser();
      const json = '{"root":"r1","elements":{"r1":{"type":"Text","props":{"label":"Hello"}}}}';

      // Feed character by character
      for (const ch of json) {
        parser.push(ch);
      }

      const obj = parser.root as any;
      expect(obj.type).toBe('object');
      expect(obj.children.get('root').value).toBe('r1');
      const elements = obj.children.get('elements');
      expect(elements.type).toBe('object');
      const r1 = elements.children.get('r1');
      expect(r1.children.get('type').value).toBe('Text');
      expect(r1.children.get('props').children.get('label').value).toBe('Hello');
    });

    it('maintains stable node identities across pushes', () => {
      const parser = createPartialJsonParser();
      parser.push('{"name":"');
      const rootId = parser.root!.id;
      const nameNode = (parser.root as any).children.get('name');
      const nameId = nameNode.id;

      parser.push('Alice"}');
      // Same root, same name node
      expect(parser.root!.id).toBe(rootId);
      expect((parser.root as any).children.get('name').id).toBe(nameId);
    });
  });

  describe('getByPath', () => {
    it('returns root for empty path', () => {
      const parser = createPartialJsonParser();
      parser.push('{"a":1}');
      expect(parser.getByPath('')).toBe(parser.root);
    });

    it('navigates object properties', () => {
      const parser = createPartialJsonParser();
      parser.push('{"elements":{"r1":{"type":"Text"}}}');
      const node = parser.getByPath('/elements/r1/type');
      expect(node).not.toBeNull();
      expect(node!.type).toBe('string');
      expect((node as any).value).toBe('Text');
    });

    it('navigates array indices', () => {
      const parser = createPartialJsonParser();
      parser.push('{"items":["a","b","c"]}');
      const node = parser.getByPath('/items/1');
      expect(node).not.toBeNull();
      expect((node as any).value).toBe('b');
    });

    it('returns null for non-existent paths', () => {
      const parser = createPartialJsonParser();
      parser.push('{"a":1}');
      expect(parser.getByPath('/b')).toBeNull();
    });
  });

  describe('whitespace handling', () => {
    it('handles whitespace between tokens', () => {
      const parser = createPartialJsonParser();
      parser.push('{ "a" : 1 , "b" : 2 }');
      const obj = parser.root as any;
      expect(obj.children.get('a').value).toBe(1);
      expect(obj.children.get('b').value).toBe(2);
    });

    it('skips leading whitespace', () => {
      const parser = createPartialJsonParser();
      parser.push('  \n\t"hello"');
      expect(parser.root!.type).toBe('string');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx test partial-json`
Expected: FAIL — `createPartialJsonParser` not found

- [ ] **Step 3: Implement the parser**

Create `libs/partial-json/src/lib/parser.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type {
  JsonNode, JsonObjectNode, JsonArrayNode, JsonStringNode,
  JsonNumberNode, JsonBooleanNode, JsonNullNode,
  ParseEvent, PartialJsonParser,
} from './types';

const enum State {
  EXPECT_VALUE,
  IN_STRING,
  IN_STRING_ESCAPE,
  IN_STRING_UNICODE,
  IN_NUMBER,
  IN_KEYWORD,
  EXPECT_KEY,
  IN_KEY_STRING,
  IN_KEY_STRING_ESCAPE,
  IN_KEY_STRING_UNICODE,
  EXPECT_COLON,
  AFTER_VALUE,
}

const WHITESPACE = new Set([' ', '\t', '\n', '\r']);
const KEYWORDS: Record<string, { type: 'boolean' | 'null'; value: boolean | null }> = {
  true: { type: 'boolean', value: true },
  false: { type: 'boolean', value: false },
  null: { type: 'null', value: null },
};

export function createPartialJsonParser(): PartialJsonParser {
  let nextId = 0;
  let root: JsonNode | null = null;
  let state = State.EXPECT_VALUE;
  /** Stack of open container/value nodes. Current node is last. */
  const stack: JsonNode[] = [];
  /** Buffer for keyword matching (true/false/null). */
  let keywordBuffer = '';
  /** Buffer for object key being read. */
  let keyBuffer = '';
  /** Unicode escape accumulator. */
  let unicodeBuffer = '';
  let unicodeCount = 0;

  function current(): JsonNode | undefined {
    return stack[stack.length - 1];
  }

  function createNode<T extends JsonNode>(partial: Omit<T, 'id' | 'parent' | 'key' | 'status'>): T {
    return {
      ...partial,
      id: nextId++,
      parent: null,
      key: null,
      status: 'pending',
    } as T;
  }

  function attachToParent(node: JsonNode): void {
    const parent = current();
    if (!parent) {
      root = node;
      return;
    }
    node.parent = parent;
    if (parent.type === 'object') {
      const objParent = parent as JsonObjectNode;
      const key = objParent.pendingKey!;
      node.key = key;
      objParent.children.set(key, node);
      objParent.pendingKey = null;
    } else if (parent.type === 'array') {
      const arrParent = parent as JsonArrayNode;
      node.key = arrParent.children.length;
      arrParent.children.push(node);
    }
  }

  function completeNumber(events: ParseEvent[]): void {
    const node = current() as JsonNumberNode;
    if (node && node.type === 'number') {
      node.value = Number(node.raw);
      node.status = 'complete';
      events.push({ type: 'node-completed', node });
      stack.pop();
    }
  }

  function afterValue(): void {
    const parent = current();
    if (!parent) {
      state = State.AFTER_VALUE;
      return;
    }
    if (parent.type === 'object') {
      state = State.AFTER_VALUE;
    } else if (parent.type === 'array') {
      state = State.AFTER_VALUE;
    } else {
      state = State.AFTER_VALUE;
    }
  }

  function processEscape(ch: string, node: JsonStringNode, events: ParseEvent[]): string {
    switch (ch) {
      case '"': return '"';
      case '\\': return '\\';
      case '/': return '/';
      case 'b': return '\b';
      case 'f': return '\f';
      case 'n': return '\n';
      case 'r': return '\r';
      case 't': return '\t';
      case 'u':
        unicodeBuffer = '';
        unicodeCount = 0;
        return ''; // Will be handled in unicode state
      default: return ch;
    }
  }

  function push(chunk: string): ParseEvent[] {
    const events: ParseEvent[] = [];

    for (let i = 0; i < chunk.length; i++) {
      const ch = chunk[i];

      switch (state) {
        case State.EXPECT_VALUE: {
          if (WHITESPACE.has(ch)) continue;
          if (ch === '"') {
            const node = createNode<JsonStringNode>({ type: 'string', value: '' });
            node.status = 'streaming';
            attachToParent(node);
            stack.push(node);
            events.push({ type: 'node-created', node });
            state = State.IN_STRING;
          } else if (ch === '{') {
            const node = createNode<JsonObjectNode>({ type: 'object', children: new Map(), pendingKey: null });
            node.status = 'streaming';
            attachToParent(node);
            stack.push(node);
            events.push({ type: 'node-created', node });
            state = State.EXPECT_KEY;
          } else if (ch === '[') {
            const node = createNode<JsonArrayNode>({ type: 'array', children: [] });
            node.status = 'streaming';
            attachToParent(node);
            stack.push(node);
            events.push({ type: 'node-created', node });
            state = State.EXPECT_VALUE;
          } else if (ch === ']') {
            // Empty array close
            const arr = current();
            if (arr && arr.type === 'array') {
              arr.status = 'complete';
              events.push({ type: 'node-completed', node: arr });
              stack.pop();
              afterValue();
            }
          } else if (ch === '-' || (ch >= '0' && ch <= '9')) {
            const node = createNode<JsonNumberNode>({ type: 'number', raw: ch, value: null });
            node.status = 'streaming';
            attachToParent(node);
            stack.push(node);
            events.push({ type: 'node-created', node });
            state = State.IN_NUMBER;
          } else if (ch === 't' || ch === 'f' || ch === 'n') {
            keywordBuffer = ch;
            state = State.IN_KEYWORD;
          }
          break;
        }

        case State.IN_STRING: {
          const node = current() as JsonStringNode;
          if (ch === '\\') {
            state = State.IN_STRING_ESCAPE;
          } else if (ch === '"') {
            node.status = 'complete';
            events.push({ type: 'node-completed', node });
            stack.pop();
            afterValue();
          } else {
            node.value += ch;
            events.push({ type: 'value-updated', node, delta: ch });
          }
          break;
        }

        case State.IN_STRING_ESCAPE: {
          const node = current() as JsonStringNode;
          if (ch === 'u') {
            unicodeBuffer = '';
            unicodeCount = 0;
            state = State.IN_STRING_UNICODE;
          } else {
            const resolved = processEscape(ch, node, events);
            node.value += resolved;
            events.push({ type: 'value-updated', node, delta: resolved });
            state = State.IN_STRING;
          }
          break;
        }

        case State.IN_STRING_UNICODE: {
          const node = current() as JsonStringNode;
          unicodeBuffer += ch;
          unicodeCount++;
          if (unicodeCount === 4) {
            const codePoint = parseInt(unicodeBuffer, 16);
            const char = String.fromCharCode(codePoint);
            node.value += char;
            events.push({ type: 'value-updated', node, delta: char });
            state = State.IN_STRING;
          }
          break;
        }

        case State.IN_NUMBER: {
          const node = current() as JsonNumberNode;
          if ((ch >= '0' && ch <= '9') || ch === '.' || ch === 'e' || ch === 'E' || ch === '+' || ch === '-') {
            node.raw += ch;
          } else {
            // Number ended — process the terminator character
            completeNumber(events);
            i--; // Re-process this character in the parent state
            afterValue();
          }
          break;
        }

        case State.IN_KEYWORD: {
          keywordBuffer += ch;
          // Check if we've matched a complete keyword
          for (const [keyword, info] of Object.entries(KEYWORDS)) {
            if (keyword === keywordBuffer) {
              if (info.type === 'boolean') {
                const node = createNode<JsonBooleanNode>({ type: 'boolean', value: info.value as boolean });
                node.status = 'complete';
                attachToParent(node);
                events.push({ type: 'node-created', node });
                events.push({ type: 'node-completed', node });
              } else {
                const node = createNode<JsonNullNode>({ type: 'null' });
                node.status = 'complete';
                attachToParent(node);
                events.push({ type: 'node-created', node });
                events.push({ type: 'node-completed', node });
              }
              keywordBuffer = '';
              afterValue();
              break;
            }
          }
          // If still a prefix of some keyword, keep accumulating
          break;
        }

        case State.EXPECT_KEY: {
          if (WHITESPACE.has(ch)) continue;
          if (ch === '"') {
            keyBuffer = '';
            state = State.IN_KEY_STRING;
          } else if (ch === '}') {
            const obj = current();
            if (obj && obj.type === 'object') {
              obj.status = 'complete';
              events.push({ type: 'node-completed', node: obj });
              stack.pop();
              afterValue();
            }
          }
          break;
        }

        case State.IN_KEY_STRING: {
          if (ch === '\\') {
            state = State.IN_KEY_STRING_ESCAPE;
          } else if (ch === '"') {
            (current() as JsonObjectNode).pendingKey = keyBuffer;
            state = State.EXPECT_COLON;
          } else {
            keyBuffer += ch;
          }
          break;
        }

        case State.IN_KEY_STRING_ESCAPE: {
          if (ch === 'u') {
            unicodeBuffer = '';
            unicodeCount = 0;
            state = State.IN_KEY_STRING_UNICODE;
          } else {
            // For key strings, resolve escape the same way
            switch (ch) {
              case '"': keyBuffer += '"'; break;
              case '\\': keyBuffer += '\\'; break;
              case '/': keyBuffer += '/'; break;
              case 'n': keyBuffer += '\n'; break;
              case 'r': keyBuffer += '\r'; break;
              case 't': keyBuffer += '\t'; break;
              default: keyBuffer += ch;
            }
            state = State.IN_KEY_STRING;
          }
          break;
        }

        case State.IN_KEY_STRING_UNICODE: {
          unicodeBuffer += ch;
          unicodeCount++;
          if (unicodeCount === 4) {
            const codePoint = parseInt(unicodeBuffer, 16);
            keyBuffer += String.fromCharCode(codePoint);
            state = State.IN_KEY_STRING;
          }
          break;
        }

        case State.EXPECT_COLON: {
          if (WHITESPACE.has(ch)) continue;
          if (ch === ':') {
            state = State.EXPECT_VALUE;
          }
          break;
        }

        case State.AFTER_VALUE: {
          if (WHITESPACE.has(ch)) continue;
          const parent = current();
          if (ch === ',') {
            if (parent && parent.type === 'object') {
              state = State.EXPECT_KEY;
            } else if (parent && parent.type === 'array') {
              state = State.EXPECT_VALUE;
            }
          } else if (ch === '}') {
            if (parent && parent.type === 'object') {
              parent.status = 'complete';
              events.push({ type: 'node-completed', node: parent });
              stack.pop();
              afterValue();
            }
          } else if (ch === ']') {
            if (parent && parent.type === 'array') {
              parent.status = 'complete';
              events.push({ type: 'node-completed', node: parent });
              stack.pop();
              afterValue();
            }
          }
          break;
        }
      }
    }

    return events;
  }

  function getByPath(path: string): JsonNode | null {
    if (!root) return null;
    if (path === '' || path === '/') return root;

    const segments = path.split('/').filter(Boolean);
    let node: JsonNode = root;

    for (const segment of segments) {
      if (node.type === 'object') {
        const child = (node as JsonObjectNode).children.get(segment);
        if (!child) return null;
        node = child;
      } else if (node.type === 'array') {
        const index = parseInt(segment, 10);
        const child = (node as JsonArrayNode).children[index];
        if (!child) return null;
        node = child;
      } else {
        return null;
      }
    }

    return node;
  }

  return {
    push,
    get root() { return root; },
    getByPath,
  };
}
```

- [ ] **Step 4: Update barrel export**

Add to `libs/partial-json/src/index.ts`:

```ts
export { createPartialJsonParser } from './lib/parser';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx nx test partial-json`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add libs/partial-json/
git commit -m "feat(partial-json): implement character-by-character streaming parser"
```

---

### Task 4: Partial JSON Parser — Materialization with Structural Sharing

**Files:**
- Create: `libs/partial-json/src/lib/materialize.ts`
- Create: `libs/partial-json/src/lib/materialize.spec.ts`
- Modify: `libs/partial-json/src/index.ts`

- [ ] **Step 1: Write failing tests**

Create `libs/partial-json/src/lib/materialize.spec.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { createPartialJsonParser } from './parser';
import { materialize } from './materialize';

describe('materialize', () => {
  it('materializes a string node', () => {
    const parser = createPartialJsonParser();
    parser.push('"hello"');
    expect(materialize(parser.root!)).toBe('hello');
  });

  it('materializes a number node', () => {
    const parser = createPartialJsonParser();
    parser.push('[42]');
    const arr = materialize(parser.root!) as number[];
    expect(arr[0]).toBe(42);
  });

  it('materializes a boolean', () => {
    const parser = createPartialJsonParser();
    parser.push('true');
    expect(materialize(parser.root!)).toBe(true);
  });

  it('materializes null', () => {
    const parser = createPartialJsonParser();
    parser.push('null');
    expect(materialize(parser.root!)).toBeNull();
  });

  it('materializes a simple object', () => {
    const parser = createPartialJsonParser();
    parser.push('{"name":"Alice","age":30}');
    expect(materialize(parser.root!)).toEqual({ name: 'Alice', age: 30 });
  });

  it('materializes an array', () => {
    const parser = createPartialJsonParser();
    parser.push('["a","b","c"]');
    expect(materialize(parser.root!)).toEqual(['a', 'b', 'c']);
  });

  it('materializes nested structures', () => {
    const parser = createPartialJsonParser();
    parser.push('{"elements":{"r1":{"type":"Text","props":{"label":"Hello"}}}}');
    expect(materialize(parser.root!)).toEqual({
      elements: { r1: { type: 'Text', props: { label: 'Hello' } } },
    });
  });

  it('materializes partial (streaming) strings', () => {
    const parser = createPartialJsonParser();
    parser.push('{"name":"Al');
    const result = materialize(parser.root!) as any;
    expect(result.name).toBe('Al');
  });

  it('materializes partial numbers as null', () => {
    const parser = createPartialJsonParser();
    parser.push('{"val":12');
    const result = materialize(parser.root!) as any;
    // Number still streaming, raw="12" but value is null until complete
    // Materialize should use the raw value parsed as number for usability
    expect(result.val).toBe(12);
  });
});

describe('materialize — structural sharing', () => {
  it('returns same reference for unchanged subtrees', () => {
    const parser = createPartialJsonParser();
    parser.push('{"a":{"x":1},"b":{"y":');

    const result1 = materialize(parser.root!) as any;
    const aRef1 = result1.a;

    // Continue streaming into b — a should be unchanged
    parser.push('2}}');
    const result2 = materialize(parser.root!) as any;

    // a subtree is complete and unchanged — same reference
    expect(result2.a).toBe(aRef1);
    // Root must be different (b changed)
    expect(result2).not.toBe(result1);
    expect(result2.b).toEqual({ y: 2 });
  });

  it('preserves sibling references when one property changes', () => {
    const parser = createPartialJsonParser();
    parser.push('{"elements":{"el-1":{"type":"Text"},"el-2":{"type":"But');

    const result1 = materialize(parser.root!) as any;
    const el1Ref = result1.elements['el-1'];

    parser.push('ton"}}}');
    const result2 = materialize(parser.root!) as any;

    // el-1 unchanged — same reference
    expect(result2.elements['el-1']).toBe(el1Ref);
    // el-2 changed — different reference
    expect(result2.elements['el-2']).toEqual({ type: 'Button' });
  });

  it('returns same reference when nothing changed', () => {
    const parser = createPartialJsonParser();
    parser.push('{"a":1}');

    const result1 = materialize(parser.root!);
    const result2 = materialize(parser.root!);
    expect(result2).toBe(result1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx test partial-json`
Expected: FAIL — `materialize` not found

- [ ] **Step 3: Implement materialization**

Create `libs/partial-json/src/lib/materialize.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type {
  JsonNode, JsonObjectNode, JsonArrayNode,
  JsonStringNode, JsonNumberNode, JsonBooleanNode,
} from './types';

/**
 * Per-node cache for materialized values. The cache is keyed by node identity
 * (the node object itself) and stores { version, value } where version is a
 * monotonically increasing counter bumped on any change to the node or descendants.
 */
const cache = new WeakMap<JsonNode, { value: unknown; status: string; childVersion: number }>();

/** Global version counter — bumped each time materialize is called. */
let globalVersion = 0;

/**
 * Recursively materializes a parse tree node into a plain JS value.
 * Uses structural sharing: unchanged subtrees return the same reference.
 */
export function materialize(node: JsonNode): unknown {
  globalVersion++;
  return materializeNode(node);
}

function materializeNode(node: JsonNode): unknown {
  switch (node.type) {
    case 'string':
      return materializeString(node as JsonStringNode);
    case 'number':
      return materializeNumber(node as JsonNumberNode);
    case 'boolean':
      return (node as JsonBooleanNode).value;
    case 'null':
      return null;
    case 'object':
      return materializeObject(node as JsonObjectNode);
    case 'array':
      return materializeArray(node as JsonArrayNode);
  }
}

function materializeString(node: JsonStringNode): string {
  return node.value;
}

function materializeNumber(node: JsonNumberNode): number | null {
  if (node.value !== null) return node.value;
  // Still streaming — parse what we have
  const parsed = Number(node.raw);
  return isNaN(parsed) ? null : parsed;
}

function materializeObject(node: JsonObjectNode): Record<string, unknown> {
  // Build a version signature from children's statuses and values
  const childVersion = computeObjectChildVersion(node);
  const cached = cache.get(node);

  if (cached && cached.status === node.status && cached.childVersion === childVersion) {
    return cached.value as Record<string, unknown>;
  }

  const result: Record<string, unknown> = {};
  for (const [key, child] of node.children) {
    result[key] = materializeNode(child);
  }

  cache.set(node, { value: result, status: node.status, childVersion });
  return result;
}

function materializeArray(node: JsonArrayNode): unknown[] {
  const childVersion = computeArrayChildVersion(node);
  const cached = cache.get(node);

  if (cached && cached.status === node.status && cached.childVersion === childVersion) {
    return cached.value as unknown[];
  }

  const result = node.children.map(child => materializeNode(child));
  cache.set(node, { value: result, status: node.status, childVersion });
  return result;
}

/**
 * Computes a lightweight version hash for an object's children.
 * Uses a combination of child count, statuses, and for leaf nodes, their values.
 */
function computeObjectChildVersion(node: JsonObjectNode): number {
  let hash = node.children.size;
  for (const [, child] of node.children) {
    hash = (hash * 31 + computeNodeVersion(child)) | 0;
  }
  return hash;
}

function computeArrayChildVersion(node: JsonArrayNode): number {
  let hash = node.children.length;
  for (const child of node.children) {
    hash = (hash * 31 + computeNodeVersion(child)) | 0;
  }
  return hash;
}

function computeNodeVersion(node: JsonNode): number {
  switch (node.type) {
    case 'string': {
      const s = (node as JsonStringNode).value;
      // Use length + last few chars as a fast hash
      return (s.length * 31 + (s.charCodeAt(s.length - 1) || 0)) | 0;
    }
    case 'number': {
      const n = node as JsonNumberNode;
      return n.value !== null ? (n.value * 1000) | 0 : n.raw.length;
    }
    case 'boolean':
      return (node as JsonBooleanNode).value ? 1 : 0;
    case 'null':
      return 0;
    case 'object':
      return computeObjectChildVersion(node as JsonObjectNode);
    case 'array':
      return computeArrayChildVersion(node as JsonArrayNode);
  }
}
```

- [ ] **Step 4: Update barrel export**

Add to `libs/partial-json/src/index.ts`:

```ts
export { materialize } from './lib/materialize';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx nx test partial-json`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add libs/partial-json/
git commit -m "feat(partial-json): add materialization with structural sharing"
```

---

### Task 5: Render Lib — Element-Level Memoization

**Files:**
- Modify: `libs/render/src/lib/render-element.component.ts:68-72`
- Modify: `libs/render/src/lib/render-element.component.spec.ts`

- [ ] **Step 1: Write failing test for memoization**

Add to the end of `libs/render/src/lib/render-element.component.spec.ts`, inside a new `describe` block:

```ts
describe('RenderElementComponent — element-level memoization', () => {
  it('element() returns same reference when spec changes but element is unchanged', () => {
    TestBed.configureTestingModule({});
    TestBed.runInInjectionContext(() => {
      const { signal, computed } = require('@angular/core');

      // Simulate two spec snapshots with structural sharing:
      // el-1 is the same reference in both, el-2 is different
      const sharedEl1 = { type: 'Text', props: { label: 'Same' } };
      const spec1 = createSpec({
        root: { type: 'Container', props: {}, children: ['el-1', 'el-2'] },
        'el-1': sharedEl1,
        'el-2': { type: 'Text', props: { label: 'Old' } },
      });

      // spec2 reuses the same el-1 reference (structural sharing)
      const spec2 = {
        ...spec1,
        elements: {
          ...spec1.elements,
          'el-2': { type: 'Text', props: { label: 'New' } },
        },
      } as Spec;
      // el-1 is the SAME object reference
      expect(spec2.elements['el-1']).toBe(spec1.elements['el-1']);

      // Simulate what the component does: computed with Object.is equality
      const specSignal = signal(spec1);
      const elementKey = signal('el-1');
      const element = computed(
        () => specSignal()?.elements?.[elementKey()],
        { equal: Object.is },
      );

      const ref1 = element();
      expect(ref1).toBe(sharedEl1);

      // Update spec — el-1 reference unchanged
      specSignal.set(spec2);
      const ref2 = element();
      // With Object.is equality, computed should return same reference
      expect(ref2).toBe(ref1);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify baseline passes (this test should pass even before the change since we're testing the pattern)**

Run: `npx nx test render`
Expected: PASS — the test validates the computed pattern itself

- [ ] **Step 3: Add `equal: Object.is` to the element() computed**

In `libs/render/src/lib/render-element.component.ts`, change line 68-72:

```ts
  /** The UIElement definition from the spec. */
  readonly element: Signal<UIElement | undefined> = computed(
    () => this.spec()?.elements?.[this.elementKey()],
    { equal: Object.is },
  );
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `npx nx test render`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add libs/render/
git commit -m "perf(render): add element-level memoization via Object.is equality"
```

---

### Task 6: ParseTreeStore — Bridge Parse Tree to Spec Signal

**Files:**
- Create: `libs/chat/src/lib/streaming/parse-tree-store.ts`
- Create: `libs/chat/src/lib/streaming/parse-tree-store.spec.ts`
- Modify: `libs/chat/src/public-api.ts`

- [ ] **Step 1: Write failing tests**

Create `libs/chat/src/lib/streaming/parse-tree-store.spec.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { createParseTreeStore } from './parse-tree-store';
import { createPartialJsonParser } from '@cacheplane/partial-json';

describe('createParseTreeStore', () => {
  it('spec is null initially', () => {
    TestBed.configureTestingModule({});
    TestBed.runInInjectionContext(() => {
      const parser = createPartialJsonParser();
      const store = createParseTreeStore(parser);
      expect(store.spec()).toBeNull();
    });
  });

  it('materializes a complete spec from streamed JSON', () => {
    TestBed.configureTestingModule({});
    TestBed.runInInjectionContext(() => {
      const parser = createPartialJsonParser();
      const store = createParseTreeStore(parser);

      const json = '{"root":"r1","elements":{"r1":{"type":"Text","props":{"label":"Hello"}}}}';
      store.push(json);

      const spec = store.spec();
      expect(spec).not.toBeNull();
      expect(spec!.root).toBe('r1');
      expect(spec!.elements['r1'].type).toBe('Text');
      expect(spec!.elements['r1'].props!['label']).toBe('Hello');
    });
  });

  it('updates spec incrementally as tokens stream', () => {
    TestBed.configureTestingModule({});
    TestBed.runInInjectionContext(() => {
      const parser = createPartialJsonParser();
      const store = createParseTreeStore(parser);

      store.push('{"root":"r1","elements":{"r1":{"type":"Te');
      const spec1 = store.spec();
      expect(spec1).not.toBeNull();
      expect(spec1!.elements['r1'].type).toBe('Te');

      store.push('xt","props":{"label":"Hello"}}}}');
      const spec2 = store.spec();
      expect(spec2!.elements['r1'].type).toBe('Text');
      expect(spec2!.elements['r1'].props!['label']).toBe('Hello');
    });
  });

  it('preserves structural sharing for unchanged elements', () => {
    TestBed.configureTestingModule({});
    TestBed.runInInjectionContext(() => {
      const parser = createPartialJsonParser();
      const store = createParseTreeStore(parser);

      store.push('{"root":"r1","elements":{"r1":{"type":"Text","props":{"label":"Done"}},"r2":{"type":"But');
      const spec1 = store.spec();
      const el1Ref = spec1!.elements['r1'];

      store.push('ton","props":{"label":"Click"}}}}');
      const spec2 = store.spec();

      // r1 was complete before r2 started streaming — reference should be preserved
      expect(spec2!.elements['r1']).toBe(el1Ref);
    });
  });

  it('tracks element accumulation states', () => {
    TestBed.configureTestingModule({});
    TestBed.runInInjectionContext(() => {
      const parser = createPartialJsonParser();
      const store = createParseTreeStore(parser);

      store.push('{"root":"r1","elements":{"r1":{"type":"Text"');
      const states = store.elementStates();
      expect(states.get('r1')).toBeDefined();
      expect(states.get('r1')!.hasType).toBe(true);
      expect(states.get('r1')!.hasProps).toBe(false);

      store.push(',"props":{"label":"Hi"}}}}');
      const states2 = store.elementStates();
      expect(states2.get('r1')!.hasType).toBe(true);
      expect(states2.get('r1')!.hasProps).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx test chat -- --testPathPattern=parse-tree-store`
Expected: FAIL — `createParseTreeStore` not found

- [ ] **Step 3: Implement ParseTreeStore**

Create `libs/chat/src/lib/streaming/parse-tree-store.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { signal, type Signal } from '@angular/core';
import type { Spec } from '@json-render/core';
import type { PartialJsonParser, JsonObjectNode } from '@cacheplane/partial-json';
import { materialize } from '@cacheplane/partial-json';

export interface ElementAccumulationState {
  hasType: boolean;
  hasProps: boolean;
  hasChildren: boolean;
  streaming: boolean;
}

export interface ParseTreeStore {
  /** Push characters to the parser and update signals. */
  push(chunk: string): void;
  /** Current materialized spec (structurally shared between updates). */
  readonly spec: Signal<Spec | null>;
  /** Per-element accumulation tracking. */
  readonly elementStates: Signal<Map<string, ElementAccumulationState>>;
}

export function createParseTreeStore(parser: PartialJsonParser): ParseTreeStore {
  const specSignal = signal<Spec | null>(null);
  const elementStatesSignal = signal<Map<string, ElementAccumulationState>>(new Map());

  function push(chunk: string): void {
    const events = parser.push(chunk);
    if (!parser.root || events.length === 0) return;

    // Materialize the full tree with structural sharing
    const raw = materialize(parser.root);
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      specSignal.set(raw as unknown as Spec);
    }

    // Update element accumulation states
    updateElementStates();
  }

  function updateElementStates(): void {
    if (!parser.root || parser.root.type !== 'object') return;
    const rootObj = parser.root as JsonObjectNode;
    const elementsNode = rootObj.children.get('elements');
    if (!elementsNode || elementsNode.type !== 'object') return;

    const states = new Map<string, ElementAccumulationState>();
    const elementsObj = elementsNode as JsonObjectNode;

    for (const [key, node] of elementsObj.children) {
      if (node.type !== 'object') continue;
      const elObj = node as JsonObjectNode;

      states.set(key, {
        hasType: elObj.children.has('type'),
        hasProps: elObj.children.has('props'),
        hasChildren: elObj.children.has('children'),
        streaming: node.status !== 'complete',
      });
    }

    elementStatesSignal.set(states);
  }

  return {
    push,
    spec: specSignal.asReadonly(),
    elementStates: elementStatesSignal.asReadonly(),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx test chat -- --testPathPattern=parse-tree-store`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/streaming/
git commit -m "feat(chat): add ParseTreeStore bridging parse tree to Spec signals"
```

---

### Task 7: ContentClassifier — Content Type Detection and Routing

**Files:**
- Create: `libs/chat/src/lib/streaming/content-classifier.ts`
- Create: `libs/chat/src/lib/streaming/content-classifier.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `libs/chat/src/lib/streaming/content-classifier.spec.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { createContentClassifier, type ContentClassifier } from './content-classifier';

describe('createContentClassifier', () => {
  function setup(): ContentClassifier {
    let classifier!: ContentClassifier;
    TestBed.configureTestingModule({});
    TestBed.runInInjectionContext(() => {
      classifier = createContentClassifier();
    });
    return classifier;
  }

  describe('initial state', () => {
    it('type is undetermined', () => {
      const c = setup();
      expect(c.type()).toBe('undetermined');
    });

    it('markdown is empty', () => {
      const c = setup();
      expect(c.markdown()).toBe('');
    });

    it('spec is null', () => {
      const c = setup();
      expect(c.spec()).toBeNull();
    });
  });

  describe('markdown detection', () => {
    it('detects plain text as markdown', () => {
      const c = setup();
      c.update('Hello, world!');
      expect(c.type()).toBe('markdown');
      expect(c.markdown()).toBe('Hello, world!');
    });

    it('accumulates markdown across updates', () => {
      const c = setup();
      c.update('Hello');
      c.update('Hello, world');
      expect(c.markdown()).toBe('Hello, world');
    });
  });

  describe('json-render detection', () => {
    it('detects leading { as json-render', () => {
      const c = setup();
      c.update('{"root":');
      expect(c.type()).toBe('json-render');
    });

    it('detects { with leading whitespace', () => {
      const c = setup();
      c.update('  \n{"root":');
      expect(c.type()).toBe('json-render');
    });

    it('produces a spec from streamed JSON', () => {
      const c = setup();
      c.update('{"root":"r1","elements":{"r1":{"type":"Text","props":{"label":"Hi"}}}}');
      expect(c.spec()).not.toBeNull();
      expect(c.spec()!.root).toBe('r1');
      expect(c.spec()!.elements['r1'].type).toBe('Text');
    });

    it('streams spec incrementally', () => {
      const c = setup();
      c.update('{"root":"r1","elements":{"r1":{"type":"Te');
      expect(c.spec()!.elements['r1'].type).toBe('Te');

      c.update('{"root":"r1","elements":{"r1":{"type":"Text","props":{"label":"Hello"}}}}');
      expect(c.spec()!.elements['r1'].type).toBe('Text');
    });

    it('markdown is empty for pure JSON', () => {
      const c = setup();
      c.update('{"root":"r1"}');
      expect(c.markdown()).toBe('');
    });
  });

  describe('delta processing', () => {
    it('only processes new characters on each update', () => {
      const c = setup();
      c.update('Hello');
      c.update('Hello, world');
      // Should not double-process "Hello"
      expect(c.markdown()).toBe('Hello, world');
    });

    it('handles empty delta gracefully', () => {
      const c = setup();
      c.update('Hello');
      c.update('Hello'); // Same content — no delta
      expect(c.markdown()).toBe('Hello');
    });
  });

  describe('type transitions', () => {
    it('type never downgrades', () => {
      const c = setup();
      c.update('Hello');
      expect(c.type()).toBe('markdown');
      // Even if we could somehow see JSON later, type doesn't go back to undetermined
    });
  });

  describe('streaming state', () => {
    it('streaming is true while content is arriving', () => {
      const c = setup();
      c.update('{"root":"r1"');
      expect(c.streaming()).toBe(true);
    });

    it('streaming becomes false after complete JSON', () => {
      const c = setup();
      c.update('{"root":"r1"}');
      // Parser has complete JSON
      expect(c.streaming()).toBe(false);
    });
  });

  describe('dispose', () => {
    it('can be called without errors', () => {
      const c = setup();
      c.update('Hello');
      expect(() => c.dispose()).not.toThrow();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx test chat -- --testPathPattern=content-classifier`
Expected: FAIL — `createContentClassifier` not found

- [ ] **Step 3: Implement ContentClassifier**

Create `libs/chat/src/lib/streaming/content-classifier.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { signal, type Signal } from '@angular/core';
import type { Spec } from '@json-render/core';
import { createPartialJsonParser } from '@cacheplane/partial-json';
import { createParseTreeStore, type ElementAccumulationState } from './parse-tree-store';

export type ContentType = 'undetermined' | 'markdown' | 'json-render' | 'a2ui' | 'mixed';

export interface ContentClassifier {
  /** Feed the full message content snapshot. Internally computes delta. */
  update(content: string): void;

  /** Reactive signals for classified output. */
  readonly type: Signal<ContentType>;
  readonly markdown: Signal<string>;
  readonly spec: Signal<Spec | null>;
  readonly elementStates: Signal<Map<string, ElementAccumulationState>>;
  readonly streaming: Signal<boolean>;

  dispose(): void;
}

type DetectionState = 'undetermined' | 'markdown' | 'json-render-partial' | 'a2ui';

export function createContentClassifier(): ContentClassifier {
  const typeSignal = signal<ContentType>('undetermined');
  const markdownSignal = signal<string>('');
  const streamingSignal = signal<boolean>(true);

  let processedLength = 0;
  let detectionState: DetectionState = 'undetermined';

  // Lazy-init: only created when JSON is detected
  const parser = createPartialJsonParser();
  const store = createParseTreeStore(parser);
  let jsonDetected = false;

  function detect(content: string): void {
    // Find first non-whitespace character
    for (let i = 0; i < content.length; i++) {
      const ch = content[i];
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') continue;

      if (ch === '{') {
        detectionState = 'json-render-partial';
        typeSignal.set('json-render');
        jsonDetected = true;
        // Feed everything from the start (including whitespace, the parser handles it)
        store.push(content);
        processedLength = content.length;
        return;
      }

      // Check for A2UI delimiter
      if (content.startsWith('---a2ui_JSON---', i)) {
        detectionState = 'a2ui';
        typeSignal.set('a2ui');
        processedLength = content.length;
        return;
      }

      // Any other character = markdown
      detectionState = 'markdown';
      typeSignal.set('markdown');
      markdownSignal.set(content);
      processedLength = content.length;
      return;
    }
    // All whitespace so far — stay undetermined
  }

  function update(content: string): void {
    if (content.length <= processedLength && detectionState !== 'undetermined') {
      return;
    }

    if (detectionState === 'undetermined') {
      detect(content);
      return;
    }

    const delta = content.slice(processedLength);
    if (!delta.length) return;
    processedLength = content.length;

    switch (detectionState) {
      case 'markdown':
        markdownSignal.set(content);
        break;
      case 'json-render-partial':
        store.push(delta);
        // Check if parsing is complete
        if (parser.root && parser.root.status === 'complete') {
          streamingSignal.set(false);
        }
        break;
      case 'a2ui':
        // A2UI accumulation (future)
        break;
    }
  }

  function dispose(): void {
    // Clean up resources if needed
  }

  return {
    update,
    type: typeSignal.asReadonly(),
    markdown: markdownSignal.asReadonly(),
    spec: store.spec,
    elementStates: store.elementStates,
    streaming: streamingSignal.asReadonly(),
    dispose,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx test chat -- --testPathPattern=content-classifier`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/streaming/
git commit -m "feat(chat): add ContentClassifier for streaming content type detection"
```

---

### Task 8: Chat Component Integration

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat/chat.component.ts`
- Modify: `libs/chat/src/lib/compositions/chat/chat.component.spec.ts`
- Modify: `libs/chat/src/public-api.ts`

**Context:** The current `ChatComponent` uses `AgentRef` (from `@cacheplane/langgraph`), has `views` input of type `ViewRegistry`, and `store` input of type `StateStore`. The AI message template uses `flex gap-3` with inline avatar (ChatGPT pattern, no "Assistant" label). `ChatGenerativeUiComponent` takes `AngularRegistry` — use `toRenderRegistry()` to convert from `ViewRegistry`.

- [ ] **Step 1: Write failing tests for classified rendering**

Create or update `libs/chat/src/lib/compositions/chat/chat.component.spec.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { createContentClassifier, type ContentClassifier } from '../../streaming/content-classifier';

describe('ChatComponent — content classification', () => {
  it('classifyMessage creates a classifier on first call and caches it', () => {
    TestBed.configureTestingModule({});
    TestBed.runInInjectionContext(() => {
      const classifiers = new Map<number, ContentClassifier>();

      function classifyMessage(content: string, index: number): ContentClassifier {
        let classifier = classifiers.get(index);
        if (!classifier) {
          classifier = createContentClassifier();
          classifiers.set(index, classifier);
        }
        classifier.update(content);
        return classifier;
      }

      const c1 = classifyMessage('Hello', 0);
      const c2 = classifyMessage('Hello, world', 0);
      expect(c2).toBe(c1); // Same instance, cached
      expect(c1.markdown()).toBe('Hello, world');
    });
  });

  it('different message indices get different classifiers', () => {
    TestBed.configureTestingModule({});
    TestBed.runInInjectionContext(() => {
      const classifiers = new Map<number, ContentClassifier>();

      function classifyMessage(content: string, index: number): ContentClassifier {
        let classifier = classifiers.get(index);
        if (!classifier) {
          classifier = createContentClassifier();
          classifiers.set(index, classifier);
        }
        classifier.update(content);
        return classifier;
      }

      const c0 = classifyMessage('Hello', 0);
      const c1 = classifyMessage('{"root":"r1"}', 1);
      expect(c0.type()).toBe('markdown');
      expect(c1.type()).toBe('json-render');
    });
  });

  it('markdown messages use the fast path (no spec)', () => {
    TestBed.configureTestingModule({});
    TestBed.runInInjectionContext(() => {
      const c = createContentClassifier();
      c.update('Just plain markdown text');
      expect(c.type()).toBe('markdown');
      expect(c.spec()).toBeNull();
      expect(c.markdown()).toBe('Just plain markdown text');
    });
  });

  it('JSON messages produce a spec and no markdown', () => {
    TestBed.configureTestingModule({});
    TestBed.runInInjectionContext(() => {
      const c = createContentClassifier();
      c.update('{"root":"r1","elements":{"r1":{"type":"Text","props":{"label":"Hi"}}}}');
      expect(c.type()).toBe('json-render');
      expect(c.spec()).not.toBeNull();
      expect(c.markdown()).toBe('');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they pass (these test the pattern, not the component template)**

Run: `npx nx test chat -- --testPathPattern=chat.component`
Expected: PASS

- [ ] **Step 3: Update ChatComponent template and logic**

Modify `libs/chat/src/lib/compositions/chat/chat.component.ts`:

Add imports at the top:

```ts
import { ChatGenerativeUiComponent } from '../../primitives/chat-generative-ui/chat-generative-ui.component';
import { toRenderRegistry } from '@cacheplane/render';
import { createContentClassifier, type ContentClassifier } from '../../streaming/content-classifier';
```

Add `ChatGenerativeUiComponent` to the `imports` array.

Add to the component class:

```ts
  private readonly classifiers = new Map<number, ContentClassifier>();

  /** Convert ViewRegistry → AngularRegistry for ChatGenerativeUiComponent. */
  readonly renderRegistry = computed(() => {
    const v = this.views();
    return v ? toRenderRegistry(v) : undefined;
  });

  classifyMessage(content: string, index: number): ContentClassifier {
    let classifier = this.classifiers.get(index);
    if (!classifier) {
      classifier = createContentClassifier();
      this.classifiers.set(index, classifier);
    }
    classifier.update(content);
    return classifier;
  }

  clearClassifiers(): void {
    for (const [, c] of this.classifiers) {
      c.dispose();
    }
    this.classifiers.clear();
  }
```

Replace the AI message template (lines 112-125) with:

```html
              <!-- AI messages: classified rendering (markdown + generative UI) -->
              <ng-template chatMessageTemplate="ai" let-message let-index="index">
                @let content = messageContent(message);
                @let classified = classifyMessage(content, index);
                <div class="flex gap-3">
                  <div
                    class="w-7 h-7 flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5"
                    style="background: var(--chat-avatar-bg); color: var(--chat-avatar-text); border-radius: var(--chat-radius-avatar);"
                  >A</div>
                  <div class="flex-1 min-w-0 flex flex-col gap-2">
                    @if (classified.markdown(); as md) {
                      <div
                        class="chat-md break-words text-[length:var(--chat-font-size)] leading-[var(--chat-line-height)]"
                        style="color: var(--chat-text);"
                        [innerHTML]="renderMd(md)"
                      ></div>
                    }

                    @if (classified.spec(); as spec) {
                      <chat-generative-ui
                        [spec]="spec"
                        [registry]="renderRegistry()"
                        [store]="store()"
                        [loading]="ref().isLoading()"
                      />
                    }
                  </div>
                </div>
              </ng-template>
```

- [ ] **Step 4: Run all chat tests**

Run: `npx nx test chat`
Expected: ALL PASS

- [ ] **Step 5: Update public-api.ts exports**

Add to `libs/chat/src/public-api.ts`:

```ts
// Streaming / Generative UI
export { createContentClassifier } from './lib/streaming/content-classifier';
export type { ContentClassifier, ContentType } from './lib/streaming/content-classifier';
export { createParseTreeStore } from './lib/streaming/parse-tree-store';
export type { ParseTreeStore, ElementAccumulationState } from './lib/streaming/parse-tree-store';
```

- [ ] **Step 6: Run all tests across affected libs**

Run: `npx nx run-many -t test -p partial-json render chat`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add libs/chat/ libs/partial-json/
git commit -m "feat(chat): integrate content classifier and generative UI rendering"
```

---

### Task 9: Final Verification and Lint

**Files:**
- All modified files

- [ ] **Step 1: Run lint across all affected projects**

Run: `npx nx run-many -t lint -p partial-json render chat`
Expected: PASS (fix any lint errors if found)

- [ ] **Step 2: Run all tests one final time**

Run: `npx nx run-many -t test -p partial-json render chat`
Expected: ALL PASS

- [ ] **Step 3: Run build for all affected projects**

Run: `npx nx run-many -t build -p partial-json render chat`
Expected: PASS

- [ ] **Step 4: Commit any lint/build fixes**

Only if needed:

```bash
git add -A
git commit -m "fix: address lint and build issues"
```
