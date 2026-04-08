// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { JsonNode, JsonObjectNode, JsonArrayNode } from './types';

/**
 * Cache entry storing the last materialized value and a version fingerprint
 * used to detect whether a subtree has changed.
 */
interface CacheEntry {
  version: string;
  value: unknown;
}

const cache = new WeakMap<JsonNode, CacheEntry>();

/**
 * Compute a lightweight version fingerprint for a node.
 * The fingerprint captures enough state to detect any change in the
 * subtree rooted at this node.
 */
function computeVersion(node: JsonNode): string {
  switch (node.type) {
    case 'string':
      return `s:${node.status}:${node.value}`;
    case 'number':
      return `n:${node.status}:${node.raw}`;
    case 'boolean':
      return `b:${node.value}`;
    case 'null':
      return 'null';
    case 'object': {
      const obj = node as JsonObjectNode;
      const parts: string[] = [`o:${obj.status}:${obj.children.size}`];
      for (const [key, child] of obj.children) {
        parts.push(`${key}=${computeVersion(child)}`);
      }
      return parts.join('|');
    }
    case 'array': {
      const arr = node as JsonArrayNode;
      const parts: string[] = [`a:${arr.status}:${arr.children.length}`];
      for (const child of arr.children) {
        parts.push(computeVersion(child));
      }
      return parts.join('|');
    }
  }
}

/**
 * Convert a parse-tree node to a plain JS value.
 *
 * Structural sharing: unchanged subtrees return the exact same object
 * reference across consecutive calls, enabling cheap `===` checks
 * in downstream consumers (e.g. Angular signals, React memos).
 */
export function materialize(node: JsonNode): unknown {
  const version = computeVersion(node);
  const cached = cache.get(node);
  if (cached && cached.version === version) {
    return cached.value;
  }

  let value: unknown;

  switch (node.type) {
    case 'string':
      value = node.value;
      break;
    case 'number':
      // Complete numbers have a parsed value; streaming ones get best-effort
      value = node.value !== null ? node.value : Number(node.raw);
      break;
    case 'boolean':
      value = node.value;
      break;
    case 'null':
      value = null;
      break;
    case 'object': {
      const obj = node as JsonObjectNode;
      const result: Record<string, unknown> = {};
      for (const [key, child] of obj.children) {
        result[key] = materialize(child);
      }
      value = result;
      break;
    }
    case 'array': {
      const arr = node as JsonArrayNode;
      value = arr.children.map((child) => materialize(child));
      break;
    }
  }

  cache.set(node, { version, value });
  return value;
}
