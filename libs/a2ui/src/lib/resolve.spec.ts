import { describe, expect, test } from 'vitest';
import { resolveDynamic } from './resolve';

describe('resolveDynamic (v0.9)', () => {
  const model = { name: 'Brian', count: 7, active: true, tags: ['a', 'b'] };

  test('passes through bare literals', () => {
    expect(resolveDynamic('hello', model)).toBe('hello');
    expect(resolveDynamic(42, model)).toBe(42);
    expect(resolveDynamic(true, model)).toBe(true);
    expect(resolveDynamic(null, model)).toBe(null);
  });

  test('resolves path against model', () => {
    expect(resolveDynamic({ path: '/name' }, model)).toBe('Brian');
    expect(resolveDynamic({ path: '/count' }, model)).toBe(7);
    expect(resolveDynamic({ path: '/missing' }, model)).toBe(undefined);
  });

  test('function calls resolve to undefined until Phase 2 ships execution', () => {
    expect(resolveDynamic({ call: 'formatString', args: { value: 'x' } }, model)).toBeUndefined();
    expect(resolveDynamic({ call: 'required' }, model)).toBeUndefined();
  });

  test('recurses into arrays element-wise', () => {
    const out = resolveDynamic(['a', { path: '/name' }], model);
    expect(out).toEqual(['a', 'Brian']);
  });

  test('bare string arrays pass through', () => {
    expect(resolveDynamic(['x', 'y'], model)).toEqual(['x', 'y']);
  });

  test('returns plain object passthrough for unrecognized shapes', () => {
    const obj = { id: 'x', children: ['a'] };
    expect(resolveDynamic(obj, model)).toEqual(obj);
  });

  test('relative path resolves against scope basePath', () => {
    expect(resolveDynamic({ path: 'name' }, model, { basePath: '', item: undefined })).toBe('Brian');
  });

  test('resolves array index path', () => {
    expect(resolveDynamic({ path: '/tags/0' }, model)).toBe('a');
    expect(resolveDynamic({ path: '/tags/1' }, model)).toBe('b');
  });
});
