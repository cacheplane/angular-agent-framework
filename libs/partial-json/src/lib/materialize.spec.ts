// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { createPartialJsonParser } from './parser';
import { materialize } from './materialize';
import type { JsonArrayNode, JsonObjectNode, JsonStringNode } from './types';

describe('materialize', () => {
  describe('basic materialization', () => {
    it('should materialize a string node', () => {
      const parser = createPartialJsonParser();
      parser.push('"hello"');
      expect(materialize(parser.root!)).toBe('hello');
    });

    it('should materialize a number node inside an array', () => {
      const parser = createPartialJsonParser();
      parser.push('[42]');
      const result = materialize(parser.root!) as unknown[];
      expect(result).toEqual([42]);
    });

    it('should materialize a boolean true', () => {
      const parser = createPartialJsonParser();
      parser.push('[true]');
      const result = materialize(parser.root!) as unknown[];
      expect(result).toEqual([true]);
    });

    it('should materialize a boolean false', () => {
      const parser = createPartialJsonParser();
      parser.push('[false]');
      const result = materialize(parser.root!) as unknown[];
      expect(result).toEqual([false]);
    });

    it('should materialize null', () => {
      const parser = createPartialJsonParser();
      parser.push('[null]');
      const result = materialize(parser.root!) as unknown[];
      expect(result).toEqual([null]);
    });

    it('should materialize a simple object', () => {
      const parser = createPartialJsonParser();
      parser.push('{"a": 1, "b": "two"}');
      const result = materialize(parser.root!) as Record<string, unknown>;
      expect(result).toEqual({ a: 1, b: 'two' });
    });

    it('should materialize an array', () => {
      const parser = createPartialJsonParser();
      parser.push('[1, 2, 3]');
      const result = materialize(parser.root!) as unknown[];
      expect(result).toEqual([1, 2, 3]);
    });

    it('should materialize nested structures', () => {
      const parser = createPartialJsonParser();
      parser.push('{"items": [{"name": "a"}, {"name": "b"}]}');
      const result = materialize(parser.root!) as Record<string, unknown>;
      expect(result).toEqual({ items: [{ name: 'a' }, { name: 'b' }] });
    });

    it('should materialize a partial streaming string', () => {
      const parser = createPartialJsonParser();
      parser.push('{"msg": "hel');
      const result = materialize(parser.root!) as Record<string, unknown>;
      expect(result).toEqual({ msg: 'hel' });
    });

    it('should materialize a partial streaming number with best-effort', () => {
      const parser = createPartialJsonParser();
      parser.push('[12');
      // Number is still streaming (not terminated), so best-effort parse
      const result = materialize(parser.root!) as unknown[];
      expect(result).toEqual([12]);
    });
  });

  describe('structural sharing', () => {
    it('should return the same reference for unchanged subtrees', () => {
      const parser = createPartialJsonParser();
      parser.push('{"a": {"x": 1}, "b": "hel');

      const result1 = materialize(parser.root!) as Record<string, unknown>;
      const aRef1 = result1['a'];

      // Stream more into b
      parser.push('lo"');
      const result2 = materialize(parser.root!) as Record<string, unknown>;
      const aRef2 = result2['a'];

      // a subtree didn't change, should be same reference
      expect(aRef2).toBe(aRef1);
      // b did change
      expect(result2['b']).toBe('hello');
    });

    it('should preserve sibling references when one property changes', () => {
      const parser = createPartialJsonParser();
      parser.push('{"x": [1, 2], "y": [3, 4], "z": "stream');

      const result1 = materialize(parser.root!) as Record<string, unknown>;
      const xRef1 = result1['x'];
      const yRef1 = result1['y'];

      // Only z changes
      parser.push('ing"');
      const result2 = materialize(parser.root!) as Record<string, unknown>;

      expect(result2['x']).toBe(xRef1);
      expect(result2['y']).toBe(yRef1);
      expect(result2['z']).toBe('streaming');
    });

    it('should return the same reference when nothing changed between calls', () => {
      const parser = createPartialJsonParser();
      parser.push('{"a": 1, "b": 2}');

      const result1 = materialize(parser.root!);
      const result2 = materialize(parser.root!);

      expect(result2).toBe(result1);
    });

    it('should detect changes in nested arrays', () => {
      const parser = createPartialJsonParser();
      parser.push('{"items": [1');

      const result1 = materialize(parser.root!) as Record<string, unknown>;
      const items1 = result1['items'] as unknown[];
      expect(items1).toEqual([1]);

      // Add another item
      parser.push(', 2]');
      const result2 = materialize(parser.root!) as Record<string, unknown>;
      const items2 = result2['items'] as unknown[];
      expect(items2).toEqual([1, 2]);

      // items array changed (new child), so different reference
      expect(items2).not.toBe(items1);
    });
  });
});
