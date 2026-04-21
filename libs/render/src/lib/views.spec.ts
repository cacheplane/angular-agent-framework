import { describe, it, expect } from 'vitest';
import { Component } from '@angular/core';
import { views, withViews, withoutViews, toRenderRegistry } from './views';

@Component({ selector: 'render-test-a', standalone: true, template: 'A' })
class CompA {}

@Component({ selector: 'render-test-b', standalone: true, template: 'B' })
class CompB {}

@Component({ selector: 'render-test-c', standalone: true, template: 'C' })
class CompC {}

describe('views()', () => {
  it('creates a frozen registry from a map', () => {
    const reg = views({ 'a': CompA, 'b': CompB });
    expect(reg['a']).toBe(CompA);
    expect(reg['b']).toBe(CompB);
    expect(Object.isFrozen(reg)).toBe(true);
  });

  it('returns empty frozen object for empty input', () => {
    const reg = views({});
    expect(Object.keys(reg)).toHaveLength(0);
    expect(Object.isFrozen(reg)).toBe(true);
  });

  it('composes via spread (last key wins)', () => {
    const base = views({ 'a': CompA });
    const override = views({ ...base, 'a': CompB });
    expect(override['a']).toBe(CompB);
  });
});

describe('withViews()', () => {
  it('adds new entries without overwriting existing', () => {
    const base = views({ 'a': CompA });
    const extended = withViews(base, { 'b': CompB, 'a': CompC });
    expect(extended['a']).toBe(CompA);
    expect(extended['b']).toBe(CompB);
  });

  it('returns a frozen registry', () => {
    const result = withViews(views({}), { 'a': CompA });
    expect(Object.isFrozen(result)).toBe(true);
  });
});

describe('withoutViews()', () => {
  it('removes named entries', () => {
    const base = views({ 'a': CompA, 'b': CompB, 'c': CompC });
    const result = withoutViews(base, 'b', 'c');
    expect(result['a']).toBe(CompA);
    expect(result['b']).toBeUndefined();
    expect(result['c']).toBeUndefined();
  });

  it('returns a frozen registry', () => {
    const result = withoutViews(views({ 'a': CompA }), 'a');
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('handles removing non-existent keys gracefully', () => {
    const base = views({ 'a': CompA });
    const result = withoutViews(base, 'nonexistent');
    expect(result['a']).toBe(CompA);
  });
});

describe('toRenderRegistry()', () => {
  it('converts ViewRegistry to AngularRegistry', () => {
    const reg = views({ 'a': CompA, 'b': CompB });
    const renderReg = toRenderRegistry(reg);
    expect(renderReg.get('a')).toBe(CompA);
    expect(renderReg.get('b')).toBe(CompB);
    expect(renderReg.names()).toContain('a');
    expect(renderReg.names()).toContain('b');
  });
});
