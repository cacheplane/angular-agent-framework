// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type {
  JsonNode,
  JsonObjectNode,
  JsonArrayNode,
  JsonStringNode,
  JsonNumberNode,
  JsonBooleanNode,
  JsonNullNode,
  ParseEvent,
  PartialJsonParser,
} from './types';

type State =
  | 'EXPECT_VALUE'
  | 'IN_STRING'
  | 'IN_STRING_ESCAPE'
  | 'IN_STRING_UNICODE'
  | 'IN_NUMBER'
  | 'IN_KEYWORD'
  | 'EXPECT_KEY'
  | 'IN_KEY_STRING'
  | 'IN_KEY_STRING_ESCAPE'
  | 'IN_KEY_STRING_UNICODE'
  | 'EXPECT_COLON'
  | 'AFTER_VALUE';

const ESCAPE_MAP: Record<string, string> = {
  '"': '"',
  '\\': '\\',
  '/': '/',
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
};

const KEYWORDS: Record<string, { type: 'boolean' | 'null'; value: boolean | null }> = {
  true: { type: 'boolean', value: true },
  false: { type: 'boolean', value: false },
  null: { type: 'null', value: null },
};

export function createPartialJsonParser(): PartialJsonParser {
  let nextId = 0;
  let root: JsonNode | null = null;
  let state: State = 'EXPECT_VALUE';
  let currentNode: JsonNode | null = null;

  // For string values
  let stringNode: JsonStringNode | null = null;

  // For unicode escapes
  let unicodeBuffer = '';
  let unicodeCount = 0;

  // For key strings in objects
  let keyBuffer = '';
  let keyUnicodeBuffer = '';
  let keyUnicodeCount = 0;

  // For keywords (true, false, null)
  let keywordBuffer = '';
  let keywordNode: JsonNode | null = null;

  // Stack of container nodes for nested structures
  const containerStack: (JsonObjectNode | JsonArrayNode)[] = [];

  function makeId(): number {
    return nextId++;
  }

  function createStringNode(parent: JsonNode | null, key: string | number | null): JsonStringNode {
    return {
      id: makeId(),
      type: 'string',
      status: 'streaming',
      parent,
      key,
      value: '',
    };
  }

  function createNumberNode(parent: JsonNode | null, key: string | number | null, firstChar: string): JsonNumberNode {
    return {
      id: makeId(),
      type: 'number',
      status: 'streaming',
      parent,
      key,
      raw: firstChar,
      value: null,
    };
  }

  function createObjectNode(parent: JsonNode | null, key: string | number | null): JsonObjectNode {
    return {
      id: makeId(),
      type: 'object',
      status: 'streaming',
      parent,
      key,
      children: new Map(),
      pendingKey: null,
    };
  }

  function createArrayNode(parent: JsonNode | null, key: string | number | null): JsonArrayNode {
    return {
      id: makeId(),
      type: 'array',
      status: 'streaming',
      parent,
      key,
      children: [],
    };
  }

  function currentContainer(): JsonObjectNode | JsonArrayNode | null {
    return containerStack.length > 0 ? containerStack[containerStack.length - 1] : null;
  }

  function getKeyForNewChild(): string | number | null {
    const container = currentContainer();
    if (!container) return null;
    if (container.type === 'object') {
      return container.pendingKey;
    }
    return container.children.length;
  }

  function attachChild(node: JsonNode): void {
    const container = currentContainer();
    if (!container) {
      root = node;
      return;
    }
    if (container.type === 'object') {
      const objContainer = container;
      const key = objContainer.pendingKey!;
      node.key = key;
      node.parent = objContainer;
      objContainer.children.set(key, node);
      objContainer.pendingKey = null;
    } else {
      node.key = container.children.length;
      node.parent = container;
      container.children.push(node);
    }
  }

  function completeNumber(numNode: JsonNumberNode, events: ParseEvent[]): void {
    numNode.value = Number(numNode.raw);
    numNode.status = 'complete';
    events.push({ type: 'node-completed', node: numNode });
  }

  function completeKeyword(events: ParseEvent[]): void {
    const kw = keywordBuffer;
    const kwDef = KEYWORDS[kw];
    if (!kwDef) return;

    const node = keywordNode!;
    if (kwDef.type === 'boolean') {
      (node as JsonBooleanNode).value = kwDef.value as boolean;
    }
    node.status = 'complete';
    events.push({ type: 'node-completed', node });
    keywordBuffer = '';
    keywordNode = null;
  }

  function push(chunk: string): ParseEvent[] {
    const events: ParseEvent[] = [];

    for (let i = 0; i < chunk.length; i++) {
      const ch = chunk[i];

      switch (state) {
        case 'EXPECT_VALUE': {
          if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') continue;
          if (ch === '"') {
            const key = getKeyForNewChild();
            const node = createStringNode(currentContainer(), key);
            attachChild(node);
            if (!root) root = node;
            stringNode = node;
            events.push({ type: 'node-created', node });
            state = 'IN_STRING';
          } else if (ch === '{') {
            const key = getKeyForNewChild();
            const node = createObjectNode(currentContainer(), key);
            attachChild(node);
            if (!root) root = node;
            events.push({ type: 'node-created', node });
            containerStack.push(node);
            state = 'EXPECT_KEY';
          } else if (ch === '[') {
            const key = getKeyForNewChild();
            const node = createArrayNode(currentContainer(), key);
            attachChild(node);
            if (!root) root = node;
            events.push({ type: 'node-created', node });
            containerStack.push(node);
            state = 'EXPECT_VALUE';
          } else if (ch === ']') {
            // Empty array close
            const container = currentContainer();
            if (container && container.type === 'array') {
              container.status = 'complete';
              containerStack.pop();
              events.push({ type: 'node-completed', node: container });
              state = containerStack.length > 0 ? 'AFTER_VALUE' : 'AFTER_VALUE';
            }
          } else if (ch === '-' || (ch >= '0' && ch <= '9')) {
            const key = getKeyForNewChild();
            const node = createNumberNode(currentContainer(), key, ch);
            attachChild(node);
            if (!root) root = node;
            events.push({ type: 'node-created', node });
            currentNode = node;
            state = 'IN_NUMBER';
          } else if (ch === 't' || ch === 'f' || ch === 'n') {
            const key = getKeyForNewChild();
            let node: JsonNode;
            if (ch === 'n') {
              node = {
                id: makeId(),
                type: 'null',
                status: 'pending',
                parent: currentContainer(),
                key,
              } as JsonNullNode;
            } else {
              node = {
                id: makeId(),
                type: 'boolean',
                status: 'pending',
                parent: currentContainer(),
                key,
                value: ch === 't',
              } as JsonBooleanNode;
            }
            attachChild(node);
            if (!root) root = node;
            events.push({ type: 'node-created', node });
            keywordBuffer = ch;
            keywordNode = node;
            state = 'IN_KEYWORD';
          }
          break;
        }

        case 'IN_STRING': {
          if (ch === '\\') {
            state = 'IN_STRING_ESCAPE';
          } else if (ch === '"') {
            stringNode!.status = 'complete';
            events.push({ type: 'node-completed', node: stringNode! });
            stringNode = null;
            state = containerStack.length > 0 ? 'AFTER_VALUE' : 'AFTER_VALUE';
          } else {
            stringNode!.value += ch;
            events.push({ type: 'value-updated', node: stringNode!, delta: ch });
          }
          break;
        }

        case 'IN_STRING_ESCAPE': {
          if (ch === 'u') {
            unicodeBuffer = '';
            unicodeCount = 0;
            state = 'IN_STRING_UNICODE';
          } else {
            const mapped = ESCAPE_MAP[ch] ?? ch;
            stringNode!.value += mapped;
            events.push({ type: 'value-updated', node: stringNode!, delta: mapped });
            state = 'IN_STRING';
          }
          break;
        }

        case 'IN_STRING_UNICODE': {
          unicodeBuffer += ch;
          unicodeCount++;
          if (unicodeCount === 4) {
            const codePoint = parseInt(unicodeBuffer, 16);
            const char = String.fromCharCode(codePoint);
            stringNode!.value += char;
            events.push({ type: 'value-updated', node: stringNode!, delta: char });
            unicodeBuffer = '';
            unicodeCount = 0;
            state = 'IN_STRING';
          }
          break;
        }

        case 'IN_NUMBER': {
          const numNode = currentNode as JsonNumberNode;
          if ((ch >= '0' && ch <= '9') || ch === '.' || ch === 'e' || ch === 'E' || ch === '+' || ch === '-') {
            numNode.raw += ch;
          } else {
            // Number terminated by this character
            completeNumber(numNode, events);
            currentNode = null;
            // Re-process this character
            if (ch === ',' || ch === ']' || ch === '}') {
              state = 'AFTER_VALUE';
              i--; // reprocess
            } else {
              state = 'AFTER_VALUE';
              i--; // reprocess
            }
          }
          break;
        }

        case 'IN_KEYWORD': {
          keywordBuffer += ch;
          const possibleKeywords = Object.keys(KEYWORDS).filter((k) => k.startsWith(keywordBuffer));
          if (possibleKeywords.length === 0) {
            // Not a valid keyword continuation - treat as terminator
            state = 'AFTER_VALUE';
            i--; // reprocess
          } else {
            const exact = KEYWORDS[keywordBuffer];
            if (exact) {
              completeKeyword(events);
              state = containerStack.length > 0 ? 'AFTER_VALUE' : 'AFTER_VALUE';
            }
            // Otherwise still accumulating
          }
          break;
        }

        case 'EXPECT_KEY': {
          if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') continue;
          if (ch === '"') {
            keyBuffer = '';
            state = 'IN_KEY_STRING';
          } else if (ch === '}') {
            // Empty object
            const container = currentContainer();
            if (container && container.type === 'object') {
              container.status = 'complete';
              containerStack.pop();
              events.push({ type: 'node-completed', node: container });
              state = containerStack.length > 0 ? 'AFTER_VALUE' : 'AFTER_VALUE';
            }
          }
          break;
        }

        case 'IN_KEY_STRING': {
          if (ch === '\\') {
            state = 'IN_KEY_STRING_ESCAPE';
          } else if (ch === '"') {
            const container = currentContainer() as JsonObjectNode;
            container.pendingKey = keyBuffer;
            state = 'EXPECT_COLON';
          } else {
            keyBuffer += ch;
          }
          break;
        }

        case 'IN_KEY_STRING_ESCAPE': {
          if (ch === 'u') {
            keyUnicodeBuffer = '';
            keyUnicodeCount = 0;
            state = 'IN_KEY_STRING_UNICODE';
          } else {
            const mapped = ESCAPE_MAP[ch] ?? ch;
            keyBuffer += mapped;
            state = 'IN_KEY_STRING';
          }
          break;
        }

        case 'IN_KEY_STRING_UNICODE': {
          keyUnicodeBuffer += ch;
          keyUnicodeCount++;
          if (keyUnicodeCount === 4) {
            const codePoint = parseInt(keyUnicodeBuffer, 16);
            keyBuffer += String.fromCharCode(codePoint);
            keyUnicodeBuffer = '';
            keyUnicodeCount = 0;
            state = 'IN_KEY_STRING';
          }
          break;
        }

        case 'EXPECT_COLON': {
          if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') continue;
          if (ch === ':') {
            state = 'EXPECT_VALUE';
          }
          break;
        }

        case 'AFTER_VALUE': {
          if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') continue;
          if (ch === ',') {
            const container = currentContainer();
            if (container) {
              if (container.type === 'object') {
                state = 'EXPECT_KEY';
              } else {
                state = 'EXPECT_VALUE';
              }
            }
          } else if (ch === '}') {
            const container = currentContainer();
            if (container && container.type === 'object') {
              container.status = 'complete';
              containerStack.pop();
              events.push({ type: 'node-completed', node: container });
              state = containerStack.length > 0 ? 'AFTER_VALUE' : 'AFTER_VALUE';
            }
          } else if (ch === ']') {
            const container = currentContainer();
            if (container && container.type === 'array') {
              container.status = 'complete';
              containerStack.pop();
              events.push({ type: 'node-completed', node: container });
              state = containerStack.length > 0 ? 'AFTER_VALUE' : 'AFTER_VALUE';
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

    // Handle paths that don't start with /
    const normalizedPath = path.startsWith('/') ? path : '/' + path;
    const segments = normalizedPath.split('/').slice(1); // remove leading empty string

    let current: JsonNode = root;
    for (const segment of segments) {
      if (current.type === 'object') {
        const child = (current as JsonObjectNode).children.get(segment);
        if (!child) return null;
        current = child;
      } else if (current.type === 'array') {
        const index = parseInt(segment, 10);
        if (isNaN(index)) return null;
        const child = (current as JsonArrayNode).children[index];
        if (!child) return null;
        current = child;
      } else {
        return null;
      }
    }
    return current;
  }

  return {
    push,
    get root() {
      return root;
    },
    getByPath,
  };
}
