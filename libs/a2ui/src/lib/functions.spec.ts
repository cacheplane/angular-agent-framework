// SPDX-License-Identifier: MIT
import { describe, expect, test, vi, afterEach } from 'vitest';
import { createA2uiFunctionRegistry } from './functions';
import { resolveDynamic } from './resolve';

const registry = createA2uiFunctionRegistry();
const model = {
  price: 1234.5,
  count: 3,
  name: 'Ada',
  date: '2026-08-17T14:30:00',
  flags: { a: true, b: false },
};

function run(call: string, args: Record<string, unknown>, m: Record<string, unknown> = model): unknown {
  return resolveDynamic({ call, args }, m, undefined, registry);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('formatNumber', () => {
  test('formats with decimals and grouping', () => {
    expect(run('formatNumber', { value: { path: '/price' }, decimals: 2, grouping: true }))
      .toBe(new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true,
      }).format(1234.5));
  });

  test('grouping off', () => {
    expect(run('formatNumber', { value: 1234.5, decimals: 0, grouping: false }))
      .toBe(new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 0, maximumFractionDigits: 0, useGrouping: false,
      }).format(1234.5));
  });

  test('non-numeric value resolves to undefined', () => {
    expect(run('formatNumber', { value: 'nope' })).toBeUndefined();
  });
});

describe('formatCurrency', () => {
  test('formats with ISO currency code', () => {
    expect(run('formatCurrency', { value: { path: '/price' }, currency: 'USD' }))
      .toBe(new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(1234.5));
  });

  test('honors decimals', () => {
    expect(run('formatCurrency', { value: 10, currency: 'EUR', decimals: 0 }))
      .toBe(new Intl.NumberFormat(undefined, {
        style: 'currency', currency: 'EUR',
        minimumFractionDigits: 0, maximumFractionDigits: 0,
      }).format(10));
  });
});

describe('formatDate', () => {
  test('formats ISO string with TR35 pattern', () => {
    const out = run('formatDate', { value: '2026-08-17T00:00:00', format: 'yyyy-MM-dd' });
    expect(out).toBe('2026-08-17');
  });

  test('month and weekday names', () => {
    const out = run('formatDate', { value: '2026-08-17T00:00:00', format: 'EEEE, MMMM d, yyyy' });
    expect(out).toBe('Monday, August 17, 2026');
  });

  test('12h time with meridiem', () => {
    const out = run('formatDate', { value: '2026-08-17T14:05:09', format: 'h:mm a' });
    expect(out).toBe('2:05 PM');
  });

  test('two-digit year and short month', () => {
    expect(run('formatDate', { value: '2026-01-05T00:00:00', format: 'MMM d, yy' })).toBe('Jan 5, 26');
  });

  test('epoch millis input', () => {
    const d = new Date(2026, 0, 2, 0, 0, 0);
    expect(run('formatDate', { value: d.getTime(), format: 'yyyy' })).toBe('2026');
  });

  test('unparseable date resolves to undefined', () => {
    expect(run('formatDate', { value: 'not a date', format: 'yyyy' })).toBeUndefined();
  });
});

describe('pluralize', () => {
  test('one vs other', () => {
    expect(run('pluralize', { value: 1, one: 'item', other: 'items' })).toBe('item');
    expect(run('pluralize', { value: { path: '/count' }, one: 'item', other: 'items' })).toBe('items');
  });

  test('zero category argument wins when provided', () => {
    expect(run('pluralize', { value: 0, zero: 'nothing', one: 'item', other: 'items' })).toBe('nothing');
  });

  test('falls back to other', () => {
    expect(run('pluralize', { value: 5, other: 'things' })).toBe('things');
  });
});

describe('logic', () => {
  test('and', () => {
    expect(run('and', { values: [true, { path: '/flags/a' }] })).toBe(true);
    expect(run('and', { values: [true, { path: '/flags/b' }] })).toBe(false);
  });

  test('or', () => {
    expect(run('or', { values: [{ path: '/flags/b' }, false] })).toBe(false);
    expect(run('or', { values: [{ path: '/flags/b' }, true] })).toBe(true);
  });

  test('not', () => {
    expect(run('not', { value: { path: '/flags/b' } })).toBe(true);
  });
});

describe('formatString interpolation', () => {
  test('absolute path expression', () => {
    expect(run('formatString', { value: 'Hello ${/name}!' })).toBe('Hello Ada!');
  });

  test('relative path resolves against scope', () => {
    const out = resolveDynamic(
      { call: 'formatString', args: { value: 'Hi ${name}' } },
      { items: [{ name: 'Bo' }] },
      { basePath: '/items/0', item: undefined },
      registry,
    );
    expect(out).toBe('Hi Bo');
  });

  test('nested function call with named args', () => {
    const out = run('formatString', {
      value: "Due ${formatDate(value:${/date}, format:'yyyy-MM-dd')}",
    });
    expect(out).toBe('Due 2026-08-17');
  });

  test('multiple expressions and literal text', () => {
    expect(run('formatString', { value: '${/name} has ${/count} items' })).toBe('Ada has 3 items');
  });

  test('escaped \\${ stays literal', () => {
    expect(run('formatString', { value: 'literal \\${/name}' })).toBe('literal ${/name}');
  });

  test('unresolvable path interpolates empty', () => {
    expect(run('formatString', { value: 'x=${/missing}!' })).toBe('x=!');
  });

  test('quoted string and number args in nested calls', () => {
    const out = run('formatString', {
      value: "${pluralize(value:${/count}, one:'thing', other:'things')}",
    });
    expect(out).toBe('things');
  });
});

describe('registry behavior', () => {
  test('unknown function resolves to undefined and warns once per name', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(run('mysteryFn', { x: 1 })).toBeUndefined();
    expect(run('mysteryFn', { x: 2 })).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  test('overrides extend the standard set', () => {
    const custom = createA2uiFunctionRegistry({
      shout: (args, ctx) => String(ctx.resolveArg(args['value'])).toUpperCase(),
    });
    expect(resolveDynamic({ call: 'shout', args: { value: { path: '/name' } } }, model, undefined, custom))
      .toBe('ADA');
  });

  test('function args recurse through nested calls', () => {
    expect(run('not', { value: { call: 'and', args: { values: [true, true] } } })).toBe(false);
  });
});

describe('validators', () => {
  test('required', () => {
    expect(run('required', { value: 'x' })).toBe(true);
    expect(run('required', { value: { path: '/name' } })).toBe(true);
    expect(run('required', { value: '' })).toBe(false);
    expect(run('required', { value: null })).toBe(false);
    expect(run('required', { value: { path: '/missing' } })).toBe(false);
    expect(run('required', { value: [] })).toBe(false);
    expect(run('required', { value: ['a'] })).toBe(true);
    expect(run('required', { value: 0 })).toBe(true);
    expect(run('required', { value: false })).toBe(true);
  });

  test('regex', () => {
    expect(run('regex', { value: 'abc-12', pattern: '^[a-z]+-\\d+$' })).toBe(true);
    expect(run('regex', { value: 'nope', pattern: '^[a-z]+-\\d+$' })).toBe(false);
    expect(run('regex', { value: 42, pattern: '\\d+' })).toBe(false);
    expect(run('regex', { value: 'x', pattern: '(' })).toBe(false); // invalid pattern
  });

  test('length', () => {
    expect(run('length', { value: 'hello', min: 2 })).toBe(true);
    expect(run('length', { value: 'h', min: 2 })).toBe(false);
    expect(run('length', { value: 'hello', max: 4 })).toBe(false);
    expect(run('length', { value: 'hi', min: 1, max: 4 })).toBe(true);
    expect(run('length', { value: 7, min: 1 })).toBe(false);
  });

  test('numeric', () => {
    expect(run('numeric', { value: 5, min: 1, max: 10 })).toBe(true);
    expect(run('numeric', { value: '5', min: 1 })).toBe(true);
    expect(run('numeric', { value: 0, min: 1 })).toBe(false);
    expect(run('numeric', { value: 11, max: 10 })).toBe(false);
    expect(run('numeric', { value: 'abc', min: 0 })).toBe(false);
  });

  test('email', () => {
    expect(run('email', { value: 'ada@example.com' })).toBe(true);
    expect(run('email', { value: 'ada@sub.example.co' })).toBe(true);
    expect(run('email', { value: 'not-an-email' })).toBe(false);
    expect(run('email', { value: 'a@b' })).toBe(false);
    expect(run('email', { value: '' })).toBe(false);
    expect(run('email', { value: 7 })).toBe(false);
  });

  test('validators compose with logic functions in check conditions', () => {
    expect(run('and', { values: [
      { call: 'required', args: { value: { path: '/name' } } },
      { call: 'length', args: { value: { path: '/name' }, min: 2 } },
    ] })).toBe(true);
  });
});
