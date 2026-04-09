// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { resolveDynamic } from './resolve';

const model = { user: { name: 'Alice', age: 30 }, items: ['a', 'b'] };

describe('resolveDynamic', () => {
  it('passes through string literals', () => {
    expect(resolveDynamic('hello', model)).toBe('hello');
  });

  it('passes through number literals', () => {
    expect(resolveDynamic(42, model)).toBe(42);
  });

  it('passes through boolean literals', () => {
    expect(resolveDynamic(true, model)).toBe(true);
  });

  it('passes through null', () => {
    expect(resolveDynamic(null, model)).toBeNull();
  });

  it('resolves absolute path references', () => {
    expect(resolveDynamic({ path: '/user/name' }, model)).toBe('Alice');
  });

  it('resolves relative path in scope', () => {
    const scope = { basePath: '/user', item: { name: 'Alice', age: 30 } };
    expect(resolveDynamic({ path: 'name' }, model, scope)).toBe('Alice');
  });

  it('interpolates template strings with ${/path}', () => {
    expect(resolveDynamic('Hello ${/user/name}!', model)).toBe('Hello Alice!');
  });

  it('interpolates multiple references', () => {
    expect(resolveDynamic('${/user/name} has ${/user/age} years', model)).toBe('Alice has 30 years');
  });

  it('handles escaped \\${ as literal', () => {
    expect(resolveDynamic('Price: \\${100}', model)).toBe('Price: ${100}');
  });

  it('returns function calls as-is (Phase 2)', () => {
    const fn = { call: 'formatDate', args: { value: '2026-01-01' } };
    expect(resolveDynamic(fn, model)).toBe('[formatDate]');
  });

  it('resolves array elements', () => {
    expect(resolveDynamic({ path: '/items/0' }, model)).toBe('a');
  });

  it('returns undefined for non-existent paths', () => {
    expect(resolveDynamic({ path: '/missing' }, model)).toBeUndefined();
  });
});
