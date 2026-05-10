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

  test('returns undefined for non-existent paths', () => {
    expect(resolveDynamic({ path: '/missing' }, model)).toBeUndefined();
  });

  test('resolves array index path', () => {
    expect(resolveDynamic({ path: '/tags/0' }, model)).toBe('a');
    expect(resolveDynamic({ path: '/tags/1' }, model)).toBe('b');
  });
});
