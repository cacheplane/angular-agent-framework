// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { getByPointer, setByPointer, deleteByPointer } from './pointer';

describe('getByPointer', () => {
  it('returns root for empty string', () => {
    const model = { a: 1 };
    expect(getByPointer(model, '')).toBe(model);
  });

  it('returns root for /', () => {
    const model = { a: 1 };
    expect(getByPointer(model, '/')).toBe(model);
  });

  it('gets a top-level property', () => {
    expect(getByPointer({ name: 'Alice' }, '/name')).toBe('Alice');
  });

  it('gets a nested property', () => {
    expect(getByPointer({ user: { profile: { name: 'Bob' } } }, '/user/profile/name')).toBe('Bob');
  });

  it('gets an array element', () => {
    expect(getByPointer({ items: ['a', 'b', 'c'] }, '/items/1')).toBe('b');
  });

  it('returns undefined for non-existent path', () => {
    expect(getByPointer({ a: 1 }, '/b')).toBeUndefined();
  });
});

describe('setByPointer', () => {
  it('sets a top-level property immutably', () => {
    const original = { name: 'Alice' };
    const result = setByPointer(original, '/name', 'Bob');
    expect(result.name).toBe('Bob');
    expect(original.name).toBe('Alice'); // immutable
  });

  it('sets a nested property immutably', () => {
    const original = { user: { name: 'Alice', age: 30 } };
    const result = setByPointer(original, '/user/name', 'Bob');
    expect(result.user.name).toBe('Bob');
    expect(result.user.age).toBe(30);
    expect(original.user.name).toBe('Alice');
  });

  it('replaces entire model for / path', () => {
    const result = setByPointer({ old: true }, '/', { new: true });
    expect(result).toEqual({ new: true });
  });

  it('creates intermediate objects', () => {
    const result = setByPointer({}, '/a/b/c', 42);
    expect(result.a.b.c).toBe(42);
  });

  it('sets array elements', () => {
    const result = setByPointer({ items: ['a', 'b'] }, '/items/1', 'x');
    expect(result.items[1]).toBe('x');
  });
});

describe('deleteByPointer', () => {
  it('removes a top-level key', () => {
    const result = deleteByPointer({ a: 1, b: 2 }, '/a');
    expect(result).toEqual({ b: 2 });
  });

  it('removes a nested key', () => {
    const result = deleteByPointer({ user: { name: 'Alice', age: 30 } }, '/user/age');
    expect(result.user).toEqual({ name: 'Alice' });
  });
});
