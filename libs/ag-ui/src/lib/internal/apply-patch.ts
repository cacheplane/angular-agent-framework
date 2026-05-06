// SPDX-License-Identifier: MIT
// Minimal RFC-6902 JSON Patch implementation, scoped to the ops the ag-ui
// reducer actually receives via STATE_DELTA events: add, replace, remove,
// move, copy, test. Pure ESM, zero deps. Replaces a CommonJS-only third-party
// dependency that broke ESM-strict consumers (Vitest, Vite test envs).

export interface JsonPatchOp {
  readonly op: 'add' | 'replace' | 'remove' | 'move' | 'copy' | 'test';
  readonly path: string;
  readonly value?: unknown;
  readonly from?: string;
}

/**
 * Apply a sequence of JSON Patch (RFC-6902) operations to `target`. Returns a
 * new document. The input is not mutated.
 *
 * Operations apply in order; if any operation fails (invalid path, failed
 * test, etc.) the whole patch throws — matching `fast-json-patch`'s
 * `validate: false` behavior used by the reducer.
 */
export function applyPatch<T>(target: T, ops: readonly JsonPatchOp[]): T {
  let current: unknown = target;
  for (const op of ops) {
    current = applyOne(current, op);
  }
  return current as T;
}

function applyOne(doc: unknown, op: JsonPatchOp): unknown {
  switch (op.op) {
    case 'add':     return setAt(doc, parsePointer(op.path), op.value, /*replaceArrayDash*/ true);
    case 'replace': return setAt(doc, parsePointer(op.path), op.value, /*replaceArrayDash*/ false);
    case 'remove':  return removeAt(doc, parsePointer(op.path));
    case 'move': {
      if (op.from == null) throw new Error("'move' op requires 'from'");
      const fromTokens = parsePointer(op.from);
      const value = getAt(doc, fromTokens);
      const removed = removeAt(doc, fromTokens);
      return setAt(removed, parsePointer(op.path), value, true);
    }
    case 'copy': {
      if (op.from == null) throw new Error("'copy' op requires 'from'");
      const value = getAt(doc, parsePointer(op.from));
      return setAt(doc, parsePointer(op.path), structuredCloneSafe(value), true);
    }
    case 'test': {
      const actual = getAt(doc, parsePointer(op.path));
      if (!deepEqual(actual, op.value)) {
        throw new Error(`'test' op failed at path ${op.path}`);
      }
      return doc;
    }
    default: {
      const o: { op: string } = op as never;
      throw new Error(`Unsupported JSON Patch op: ${o.op}`);
    }
  }
}

/**
 * Parse an RFC-6901 JSON Pointer string into its tokens.
 *   ""        → []
 *   "/foo/0"  → ["foo", "0"]
 *   "/a~1b"   → ["a/b"]   (~1 → /)
 *   "/a~0b"   → ["a~b"]   (~0 → ~)
 */
export function parsePointer(pointer: string): string[] {
  if (pointer === '') return [];
  if (!pointer.startsWith('/')) {
    throw new Error(`Invalid JSON Pointer: ${pointer}`);
  }
  return pointer
    .slice(1)
    .split('/')
    .map(token => token.replace(/~1/g, '/').replace(/~0/g, '~'));
}

function getAt(doc: unknown, tokens: readonly string[]): unknown {
  let cur: unknown = doc;
  for (const token of tokens) {
    cur = stepInto(cur, token);
  }
  return cur;
}

function stepInto(node: unknown, token: string): unknown {
  if (Array.isArray(node)) {
    const i = parseArrayIndex(token, node.length);
    return node[i];
  }
  if (node !== null && typeof node === 'object') {
    return (node as Record<string, unknown>)[token];
  }
  throw new Error(`Cannot traverse non-container at token "${token}"`);
}

function setAt(
  doc: unknown,
  tokens: readonly string[],
  value: unknown,
  allowArrayAppend: boolean,
): unknown {
  if (tokens.length === 0) {
    // Replace root.
    return structuredCloneSafe(value);
  }
  const [head, ...rest] = tokens;
  if (Array.isArray(doc)) {
    const arr = doc.slice();
    const i = head === '-' && allowArrayAppend ? arr.length : parseArrayIndex(head!, arr.length + (allowArrayAppend ? 1 : 0));
    if (rest.length === 0) {
      if (allowArrayAppend) {
        // RFC-6902 add: insert at index, shifting elements right
        arr.splice(i, 0, structuredCloneSafe(value));
      } else {
        // replace: overwrite at index
        if (i >= arr.length) throw new Error(`Cannot replace beyond array length at "/${tokens.join('/')}"`);
        arr[i] = structuredCloneSafe(value);
      }
    } else {
      if (i >= arr.length) throw new Error(`Cannot descend into non-existent array index ${i}`);
      arr[i] = setAt(arr[i], rest, value, allowArrayAppend);
    }
    return arr;
  }
  if (doc === null || typeof doc !== 'object') {
    throw new Error(`Cannot descend into non-container at "/${tokens.join('/')}"`);
  }
  const obj = { ...(doc as Record<string, unknown>) };
  if (rest.length === 0) {
    obj[head!] = structuredCloneSafe(value);
  } else {
    if (!(head! in obj)) {
      throw new Error(`Cannot descend into missing path "/${tokens.join('/')}"`);
    }
    obj[head!] = setAt(obj[head!], rest, value, allowArrayAppend);
  }
  return obj;
}

function removeAt(doc: unknown, tokens: readonly string[]): unknown {
  if (tokens.length === 0) {
    throw new Error('Cannot remove root');
  }
  const [head, ...rest] = tokens;
  if (Array.isArray(doc)) {
    const arr = doc.slice();
    const i = parseArrayIndex(head!, arr.length);
    if (i >= arr.length) throw new Error(`Cannot remove non-existent array index ${i}`);
    if (rest.length === 0) {
      arr.splice(i, 1);
    } else {
      arr[i] = removeAt(arr[i], rest);
    }
    return arr;
  }
  if (doc === null || typeof doc !== 'object') {
    throw new Error(`Cannot remove from non-container at token "${head}"`);
  }
  const obj = { ...(doc as Record<string, unknown>) };
  if (rest.length === 0) {
    if (!(head! in obj)) throw new Error(`Cannot remove non-existent key "${head}"`);
    delete obj[head!];
  } else {
    if (!(head! in obj)) throw new Error(`Cannot descend into missing path "${head}"`);
    obj[head!] = removeAt(obj[head!], rest);
  }
  return obj;
}

function parseArrayIndex(token: string, lengthBound: number): number {
  if (token === '-') {
    // "-" is the "after-last" sentinel; only valid for `add` (handled by caller)
    throw new Error(`Array end marker "-" not valid in this position`);
  }
  if (!/^(0|[1-9]\d*)$/.test(token)) {
    throw new Error(`Invalid array index: "${token}"`);
  }
  const i = Number.parseInt(token, 10);
  if (i > lengthBound) {
    throw new Error(`Array index ${i} exceeds bound ${lengthBound}`);
  }
  return i;
}

function structuredCloneSafe<T>(v: T): T {
  // Cheap deep clone for JSON-like values (no functions, no cycles) — matches
  // the deep-clone the reducer was already doing pre-applyPatch with the prior
  // dependency.
  if (v === null || typeof v !== 'object') return v;
  return JSON.parse(JSON.stringify(v)) as T;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const aKeys = Object.keys(ao);
  const bKeys = Object.keys(bo);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(bo, k)) return false;
    if (!deepEqual(ao[k], bo[k])) return false;
  }
  return true;
}
