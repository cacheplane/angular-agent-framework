// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { applyPatch, parsePointer, type JsonPatchOp } from './apply-patch';

describe('parsePointer', () => {
  it('returns empty array for the root pointer', () => {
    expect(parsePointer('')).toEqual([]);
  });

  it('splits a simple path', () => {
    expect(parsePointer('/foo/bar')).toEqual(['foo', 'bar']);
  });

  it('parses array indices as string tokens', () => {
    expect(parsePointer('/items/0/name')).toEqual(['items', '0', 'name']);
  });

  it('unescapes ~1 → "/"', () => {
    expect(parsePointer('/a~1b')).toEqual(['a/b']);
  });

  it('unescapes ~0 → "~"', () => {
    expect(parsePointer('/a~0b')).toEqual(['a~b']);
  });

  it('throws on a non-rooted pointer', () => {
    expect(() => parsePointer('foo')).toThrowError(/Invalid JSON Pointer/);
  });
});

describe('applyPatch — add', () => {
  it('adds a property at a top-level path', () => {
    const out = applyPatch({ a: 1 }, [{ op: 'add', path: '/b', value: 2 }]);
    expect(out).toEqual({ a: 1, b: 2 });
  });

  it('adds an element to an array (insert at index)', () => {
    const out = applyPatch({ xs: [1, 3] }, [{ op: 'add', path: '/xs/1', value: 2 }]);
    expect(out).toEqual({ xs: [1, 2, 3] });
  });

  it('appends to an array via "-"', () => {
    const out = applyPatch({ xs: [1, 2] }, [{ op: 'add', path: '/xs/-', value: 3 }]);
    expect(out).toEqual({ xs: [1, 2, 3] });
  });

  it('replaces the root when path is ""', () => {
    const out = applyPatch({ a: 1 }, [{ op: 'add', path: '', value: { b: 2 } }]);
    expect(out).toEqual({ b: 2 });
  });

  it('does not mutate the input', () => {
    const input = { a: 1 };
    const out = applyPatch(input, [{ op: 'add', path: '/b', value: 2 }]);
    expect(input).toEqual({ a: 1 });
    expect(out).not.toBe(input);
  });
});

describe('applyPatch — replace', () => {
  it('replaces an existing property', () => {
    const out = applyPatch({ a: 1 }, [{ op: 'replace', path: '/a', value: 9 }]);
    expect(out).toEqual({ a: 9 });
  });

  it('replaces a nested property', () => {
    const out = applyPatch(
      { user: { name: 'old' } },
      [{ op: 'replace', path: '/user/name', value: 'new' }],
    );
    expect(out).toEqual({ user: { name: 'new' } });
  });

  it('replaces an array element by index', () => {
    const out = applyPatch({ xs: [1, 2, 3] }, [{ op: 'replace', path: '/xs/1', value: 99 }]);
    expect(out).toEqual({ xs: [1, 99, 3] });
  });
});

describe('applyPatch — remove', () => {
  it('removes a top-level property', () => {
    const out = applyPatch({ a: 1, b: 2 }, [{ op: 'remove', path: '/b' }]);
    expect(out).toEqual({ a: 1 });
  });

  it('removes an array element by index (shifts remaining)', () => {
    const out = applyPatch({ xs: [1, 2, 3] }, [{ op: 'remove', path: '/xs/1' }]);
    expect(out).toEqual({ xs: [1, 3] });
  });

  it('throws on missing key', () => {
    expect(() =>
      applyPatch({ a: 1 }, [{ op: 'remove', path: '/missing' }]),
    ).toThrowError(/non-existent key/);
  });
});

describe('applyPatch — composition', () => {
  it('applies multiple ops in order', () => {
    const ops: JsonPatchOp[] = [
      { op: 'add', path: '/b', value: 2 },
      { op: 'replace', path: '/a', value: 99 },
      { op: 'remove', path: '/b' },
    ];
    const out = applyPatch({ a: 1 }, ops);
    expect(out).toEqual({ a: 99 });
  });

  it('mid-batch failure throws (no partial commit semantics required by reducer)', () => {
    expect(() =>
      applyPatch({ a: 1 }, [
        { op: 'replace', path: '/a', value: 2 },
        { op: 'remove', path: '/missing' },
      ]),
    ).toThrowError();
  });
});

describe('applyPatch — escape sequences in pointer', () => {
  it('handles "/" in keys via ~1', () => {
    const out = applyPatch({ 'a/b': 1 }, [{ op: 'replace', path: '/a~1b', value: 2 }]);
    expect(out).toEqual({ 'a/b': 2 });
  });

  it('handles "~" in keys via ~0', () => {
    const out = applyPatch({ 'a~b': 1 }, [{ op: 'replace', path: '/a~0b', value: 2 }]);
    expect(out).toEqual({ 'a~b': 2 });
  });
});

describe('applyPatch — move/copy/test', () => {
  it('move: relocates a value from one path to another', () => {
    const out = applyPatch(
      { a: 1, b: 2 },
      [{ op: 'move', path: '/c', from: '/b' }],
    );
    expect(out).toEqual({ a: 1, c: 2 });
  });

  it('copy: duplicates a value at a new path', () => {
    const out = applyPatch(
      { a: { x: 1 } },
      [{ op: 'copy', path: '/b', from: '/a' }],
    );
    expect(out).toEqual({ a: { x: 1 }, b: { x: 1 } });
    // Confirm deep clone (no shared reference)
    (out as { a: { x: number }; b: { x: number } }).b.x = 99;
    expect((out as { a: { x: number } }).a.x).toBe(1);
  });

  it('test: passes when the value matches', () => {
    const out = applyPatch({ a: 1 }, [{ op: 'test', path: '/a', value: 1 }]);
    expect(out).toEqual({ a: 1 });
  });

  it('test: throws when the value does not match', () => {
    expect(() =>
      applyPatch({ a: 1 }, [{ op: 'test', path: '/a', value: 2 }]),
    ).toThrowError(/'test' op failed/);
  });
});
