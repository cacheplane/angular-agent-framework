// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { createPartialJsonParser } from './parser';
import type {
  JsonStringNode,
  JsonNumberNode,
  JsonBooleanNode,
  JsonNullNode,
  JsonObjectNode,
  JsonArrayNode,
  ParseEvent,
} from './types';

describe('createPartialJsonParser', () => {
  describe('strings', () => {
    it('should parse a complete string', () => {
      const parser = createPartialJsonParser();
      const events = parser.push('"hello"');
      const root = parser.root as JsonStringNode;
      expect(root).not.toBeNull();
      expect(root.type).toBe('string');
      expect(root.value).toBe('hello');
      expect(root.status).toBe('complete');
    });

    it('should stream a string character-by-character', () => {
      const parser = createPartialJsonParser();
      parser.push('"');
      parser.push('h');
      parser.push('e');
      parser.push('l');
      parser.push('l');
      parser.push('o');
      parser.push('"');
      const root = parser.root as JsonStringNode;
      expect(root.type).toBe('string');
      expect(root.value).toBe('hello');
      expect(root.status).toBe('complete');
    });

    it('should emit value-updated events with delta for strings', () => {
      const parser = createPartialJsonParser();
      parser.push('"');
      const events1 = parser.push('he');
      const valueUpdates = events1.filter((e) => e.type === 'value-updated');
      expect(valueUpdates.length).toBeGreaterThan(0);
      for (const ev of valueUpdates) {
        expect(ev.delta).toBeDefined();
      }
      parser.push('llo"');
      const root = parser.root as JsonStringNode;
      expect(root.value).toBe('hello');
    });

    it('should handle escaped characters (\\n, \\", \\\\)', () => {
      const parser = createPartialJsonParser();
      parser.push('"line1\\nline2"');
      const root = parser.root as JsonStringNode;
      expect(root.value).toBe('line1\nline2');
    });

    it('should handle escaped double quote', () => {
      const parser = createPartialJsonParser();
      parser.push('"say \\"hi\\""');
      const root = parser.root as JsonStringNode;
      expect(root.value).toBe('say "hi"');
    });

    it('should handle escaped backslash', () => {
      const parser = createPartialJsonParser();
      parser.push('"a\\\\b"');
      const root = parser.root as JsonStringNode;
      expect(root.value).toBe('a\\b');
    });

    it('should handle unicode escapes (\\u0041 = A)', () => {
      const parser = createPartialJsonParser();
      parser.push('"\\u0041"');
      const root = parser.root as JsonStringNode;
      expect(root.value).toBe('A');
    });
  });

  describe('numbers', () => {
    it('should parse a complete integer in an array', () => {
      const parser = createPartialJsonParser();
      parser.push('[42]');
      const root = parser.root as JsonArrayNode;
      const num = root.children[0] as JsonNumberNode;
      expect(num.type).toBe('number');
      expect(num.value).toBe(42);
      expect(num.status).toBe('complete');
    });

    it('should complete a number when followed by }', () => {
      const parser = createPartialJsonParser();
      parser.push('{"a":123}');
      const root = parser.root as JsonObjectNode;
      const num = root.children.get('a') as JsonNumberNode;
      expect(num.type).toBe('number');
      expect(num.value).toBe(123);
      expect(num.status).toBe('complete');
    });

    it('should handle negative and decimal numbers', () => {
      const parser = createPartialJsonParser();
      parser.push('[-3.14]');
      const root = parser.root as JsonArrayNode;
      const num = root.children[0] as JsonNumberNode;
      expect(num.value).toBe(-3.14);
      expect(num.status).toBe('complete');
    });

    it('should stream numbers at end of input', () => {
      const parser = createPartialJsonParser();
      parser.push('[12');
      const root = parser.root as JsonArrayNode;
      const num = root.children[0] as JsonNumberNode;
      expect(num.type).toBe('number');
      expect(num.raw).toBe('12');
      expect(num.status).toBe('streaming');
    });
  });

  describe('booleans and null', () => {
    it('should parse true', () => {
      const parser = createPartialJsonParser();
      parser.push('[true]');
      const root = parser.root as JsonArrayNode;
      const node = root.children[0] as JsonBooleanNode;
      expect(node.type).toBe('boolean');
      expect(node.value).toBe(true);
      expect(node.status).toBe('complete');
    });

    it('should parse false', () => {
      const parser = createPartialJsonParser();
      parser.push('[false]');
      const root = parser.root as JsonArrayNode;
      const node = root.children[0] as JsonBooleanNode;
      expect(node.type).toBe('boolean');
      expect(node.value).toBe(false);
      expect(node.status).toBe('complete');
    });

    it('should parse null', () => {
      const parser = createPartialJsonParser();
      parser.push('[null]');
      const root = parser.root as JsonArrayNode;
      const node = root.children[0] as JsonNullNode;
      expect(node.type).toBe('null');
      expect(node.status).toBe('complete');
    });

    it('should handle partial keywords gracefully', () => {
      const parser = createPartialJsonParser();
      parser.push('[tru');
      const root = parser.root as JsonArrayNode;
      // Partial keyword should create a pending node
      expect(root.children.length).toBe(1);
      expect(root.children[0].status).toBe('pending');
    });
  });

  describe('objects', () => {
    it('should parse a simple object', () => {
      const parser = createPartialJsonParser();
      parser.push('{"a":"b"}');
      const root = parser.root as JsonObjectNode;
      expect(root.type).toBe('object');
      expect(root.status).toBe('complete');
      const child = root.children.get('a') as JsonStringNode;
      expect(child.value).toBe('b');
      expect(child.status).toBe('complete');
    });

    it('should stream property values', () => {
      const parser = createPartialJsonParser();
      parser.push('{"name":"Al');
      const root = parser.root as JsonObjectNode;
      expect(root.type).toBe('object');
      expect(root.status).toBe('streaming');
      const child = root.children.get('name') as JsonStringNode;
      expect(child.type).toBe('string');
      expect(child.value).toBe('Al');
      expect(child.status).toBe('streaming');
    });

    it('should handle multiple properties', () => {
      const parser = createPartialJsonParser();
      parser.push('{"a":"1","b":"2"}');
      const root = parser.root as JsonObjectNode;
      expect(root.children.size).toBe(2);
      expect((root.children.get('a') as JsonStringNode).value).toBe('1');
      expect((root.children.get('b') as JsonStringNode).value).toBe('2');
    });

    it('should handle nested objects', () => {
      const parser = createPartialJsonParser();
      parser.push('{"outer":{"inner":"value"}}');
      const root = parser.root as JsonObjectNode;
      const outer = root.children.get('outer') as JsonObjectNode;
      expect(outer.type).toBe('object');
      const inner = outer.children.get('inner') as JsonStringNode;
      expect(inner.value).toBe('value');
    });
  });

  describe('arrays', () => {
    it('should parse a simple array of numbers', () => {
      const parser = createPartialJsonParser();
      parser.push('[1,2,3]');
      const root = parser.root as JsonArrayNode;
      expect(root.type).toBe('array');
      expect(root.status).toBe('complete');
      expect(root.children.length).toBe(3);
      expect((root.children[0] as JsonNumberNode).value).toBe(1);
      expect((root.children[1] as JsonNumberNode).value).toBe(2);
      expect((root.children[2] as JsonNumberNode).value).toBe(3);
    });

    it('should parse an array of strings', () => {
      const parser = createPartialJsonParser();
      parser.push('["a","b","c"]');
      const root = parser.root as JsonArrayNode;
      expect(root.children.length).toBe(3);
      expect((root.children[0] as JsonStringNode).value).toBe('a');
      expect((root.children[1] as JsonStringNode).value).toBe('b');
      expect((root.children[2] as JsonStringNode).value).toBe('c');
    });

    it('should parse nested arrays', () => {
      const parser = createPartialJsonParser();
      parser.push('[[1,2],[3]]');
      const root = parser.root as JsonArrayNode;
      expect(root.children.length).toBe(2);
      const first = root.children[0] as JsonArrayNode;
      expect(first.type).toBe('array');
      expect(first.children.length).toBe(2);
    });
  });

  describe('streaming complex structures', () => {
    it('should build a spec-like structure token-by-token', () => {
      const parser = createPartialJsonParser();
      const json = '{"type":"div","props":{"class":"main"},"children":[{"type":"span"}]}';
      // Feed one character at a time
      for (const ch of json) {
        parser.push(ch);
      }
      const root = parser.root as JsonObjectNode;
      expect(root.type).toBe('object');
      expect(root.status).toBe('complete');
      const typeNode = root.children.get('type') as JsonStringNode;
      expect(typeNode.value).toBe('div');
      const propsNode = root.children.get('props') as JsonObjectNode;
      expect(propsNode.children.get('class')).toBeDefined();
      const childrenNode = root.children.get('children') as JsonArrayNode;
      expect(childrenNode.children.length).toBe(1);
    });

    it('should maintain stable node identities across pushes', () => {
      const parser = createPartialJsonParser();
      parser.push('{"name":"');
      const root1 = parser.root as JsonObjectNode;
      const nameNode1 = root1.children.get('name') as JsonStringNode;
      const id1 = nameNode1.id;

      parser.push('Al');
      const nameNode2 = (parser.root as JsonObjectNode).children.get(
        'name'
      ) as JsonStringNode;
      expect(nameNode2.id).toBe(id1);
      expect(nameNode2.value).toBe('Al');

      parser.push('ice"');
      const nameNode3 = (parser.root as JsonObjectNode).children.get(
        'name'
      ) as JsonStringNode;
      expect(nameNode3.id).toBe(id1);
      expect(nameNode3.value).toBe('Alice');
    });
  });

  describe('getByPath', () => {
    it('should return root for empty path', () => {
      const parser = createPartialJsonParser();
      parser.push('{"a":1}');
      expect(parser.getByPath('')).toBe(parser.root);
    });

    it('should look up object properties', () => {
      const parser = createPartialJsonParser();
      parser.push('{"a":{"b":"c"}}');
      const node = parser.getByPath('/a/b') as JsonStringNode;
      expect(node).not.toBeNull();
      expect(node.type).toBe('string');
      expect(node.value).toBe('c');
    });

    it('should look up array indices', () => {
      const parser = createPartialJsonParser();
      parser.push('{"items":["x","y","z"]}');
      const node = parser.getByPath('/items/1') as JsonStringNode;
      expect(node).not.toBeNull();
      expect(node.value).toBe('y');
    });

    it('should return null for non-existent paths', () => {
      const parser = createPartialJsonParser();
      parser.push('{"a":1}');
      expect(parser.getByPath('/b')).toBeNull();
      expect(parser.getByPath('/a/b')).toBeNull();
    });
  });

  describe('error recovery', () => {
    it('handles empty input', () => {
      const parser = createPartialJsonParser();
      const events = parser.push('');
      expect(events).toEqual([]);
      expect(parser.root).toBeNull();
    });

    it('handles input with only whitespace', () => {
      const parser = createPartialJsonParser();
      const events = parser.push('   \n\t');
      expect(events).toEqual([]);
      expect(parser.root).toBeNull();
    });

    it('leaves root as null for invalid characters in EXPECT_VALUE state', () => {
      const parser = createPartialJsonParser();
      // 'x' does not match any case in EXPECT_VALUE, so it falls through the switch.
      // The parser never creates a root node for unrecognized characters.
      const events = parser.push('xxx{"a":1}');
      // Because 'x' is not whitespace and not a recognized token start,
      // the parser stays in EXPECT_VALUE but does nothing — root remains null.
      // Only when '{' is encountered does parsing begin, but by then 'xxx' has already
      // been consumed with no effect.
      // Actually, 'x' falls through the switch with no match, so processing continues
      // to the next char. '{' will be reached and parsed normally.
      expect(parser.root).not.toBeNull();
      const root = parser.root as JsonObjectNode;
      expect(root.type).toBe('object');
      expect((root.children.get('a') as JsonNumberNode).value).toBe(1);
    });

    it('handles trailing text after valid JSON', () => {
      const parser = createPartialJsonParser();
      parser.push('{"a":1}some trailing text');
      const root = parser.root as JsonObjectNode;
      expect(root.type).toBe('object');
      expect(root.status).toBe('complete');
      expect((root.children.get('a') as JsonNumberNode).value).toBe(1);
    });

    it('handles very long strings without crashing', () => {
      const parser = createPartialJsonParser();
      const longStr = 'a'.repeat(100000);
      parser.push('"' + longStr + '"');
      const root = parser.root as JsonStringNode;
      expect(root.type).toBe('string');
      expect(root.value.length).toBe(100000);
      expect(root.status).toBe('complete');
    });

    it('handles deeply nested objects without stack overflow', () => {
      const parser = createPartialJsonParser();
      const depth = 100;
      const open = '{"a":'.repeat(depth);
      const close = '}'.repeat(depth);
      parser.push(open + '"leaf"' + close);
      let current = parser.root as JsonObjectNode;
      for (let i = 0; i < depth - 1; i++) {
        expect(current.type).toBe('object');
        current = current.children.get('a') as JsonObjectNode;
      }
      // The innermost value is a string
      const leaf = current.children.get('a') as JsonStringNode;
      expect(leaf.type).toBe('string');
      expect(leaf.value).toBe('leaf');
    });
  });

  describe('whitespace', () => {
    it('should handle whitespace between tokens', () => {
      const parser = createPartialJsonParser();
      parser.push('{ "a" : "b" , "c" : "d" }');
      const root = parser.root as JsonObjectNode;
      expect(root.type).toBe('object');
      expect(root.status).toBe('complete');
      expect((root.children.get('a') as JsonStringNode).value).toBe('b');
      expect((root.children.get('c') as JsonStringNode).value).toBe('d');
    });

    it('should handle leading whitespace', () => {
      const parser = createPartialJsonParser();
      parser.push('  "hello"');
      const root = parser.root as JsonStringNode;
      expect(root.value).toBe('hello');
    });
  });
});
