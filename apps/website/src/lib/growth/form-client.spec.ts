// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getAcquisitionSessionId,
  growthFormRequestSnapshot,
  type GrowthFormFacts,
} from './form-client';

const SESSION_KEY = 'threadplane_acquisition_session_v1';

describe('growth form request snapshots', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('reuses only a valid unexpired acquisition session UUID', () => {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        id: '30000000-0000-4000-8000-000000000003',
        expiresAt: 2_000,
      })
    );
    expect(getAcquisitionSessionId(1_000)).toBe(
      '30000000-0000-4000-8000-000000000003'
    );

    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ id: 'not-a-uuid', expiresAt: 2_000 })
    );
    expect(getAcquisitionSessionId(1_000)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
    );

    const expired = JSON.parse(String(sessionStorage.getItem(SESSION_KEY))) as {
      id: string;
    };
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ id: expired.id, expiresAt: 999 })
    );
    expect(getAcquisitionSessionId(1_000)).not.toBe(expired.id);
  });

  it('replaces an acquisition session whose expiry exceeds the fixed TTL', () => {
    const now = 10_000;
    const corruptId = '30000000-0000-4000-8000-000000000003';
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ id: corruptId, expiresAt: now + 1_800_001 })
    );

    const replacement = getAcquisitionSessionId(now);
    const stored = JSON.parse(String(sessionStorage.getItem(SESSION_KEY))) as {
      expiresAt: number;
      id: string;
    };

    expect(replacement).not.toBe(corruptId);
    expect(stored).toEqual({
      expiresAt: now + 1_800_000,
      id: replacement,
    });

    const boundaryId = '40000000-0000-4000-8000-000000000004';
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ id: boundaryId, expiresAt: now + 1_800_000 })
    );
    expect(getAcquisitionSessionId(now)).toBe(boundaryId);
  });

  it('retains the full uncertain-retry identity and facts despite session storage changes', () => {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        id: '30000000-0000-4000-8000-000000000003',
        expiresAt: Date.now() + 60_000,
      })
    );
    const first = growthFormRequestSnapshot(null, {
      email: 'reader@example.com',
      paper: 'chat',
    });
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        id: '40000000-0000-4000-8000-000000000004',
        expiresAt: Date.now() + 60_000,
      })
    );

    const replay = growthFormRequestSnapshot(first, {
      email: 'reader@example.com',
      paper: 'chat',
    });

    expect(replay).toBe(first);
    expect(replay.acquisition_session_id).toBe(
      '30000000-0000-4000-8000-000000000003'
    );
    expect(replay.facts).toEqual({
      email: 'reader@example.com',
      paper: 'chat',
    });
  });

  it('starts a new immutable snapshot when submitted facts change', () => {
    const mutableFacts = { email: 'first@example.com', message: 'First' };
    const first = growthFormRequestSnapshot(null, mutableFacts);
    mutableFacts.message = 'mutated after capture';

    expect(first.facts).toEqual({
      email: 'first@example.com',
      message: 'First',
    });

    const edited = growthFormRequestSnapshot(first, {
      email: 'first@example.com',
      message: 'Edited',
    });
    expect(edited.submission_id).not.toBe(first.submission_id);
    expect(edited.facts.message).toBe('Edited');
  });

  it('deeply snapshots nested facts and ignores object key order on retry', () => {
    const mutableFacts = {
      email: 'reader@example.com',
      metadata: { interests: ['angular', 'agents'] },
    };
    const first = growthFormRequestSnapshot(null, mutableFacts);
    mutableFacts.metadata.interests[0] = 'mutated';

    expect(first.facts).toEqual({
      email: 'reader@example.com',
      metadata: { interests: ['angular', 'agents'] },
    });
    expect(Object.isFrozen(first.facts)).toBe(true);
    expect(Object.isFrozen(first.facts.metadata)).toBe(true);
    expect(Object.isFrozen(first.facts.metadata.interests)).toBe(true);

    const retry = growthFormRequestSnapshot(first, {
      metadata: { interests: ['angular', 'agents'] },
      email: 'reader@example.com',
    });
    expect(retry).toBe(first);
  });

  it('uses code-unit ordering for distinct canonically equivalent Unicode keys', () => {
    const composed = '\u00e9';
    const decomposed = 'e\u0301';
    const firstFacts: Record<string, string> = {};
    firstFacts[composed] = 'composed';
    firstFacts[decomposed] = 'decomposed';
    const reverseFacts: Record<string, string> = {};
    reverseFacts[decomposed] = 'decomposed';
    reverseFacts[composed] = 'composed';

    const first = growthFormRequestSnapshot(null, firstFacts);
    const retry = growthFormRequestSnapshot(first, reverseFacts);

    expect(composed).not.toBe(decomposed);
    expect(retry).toBe(first);
    expect(retry.fingerprint).toBe(first.fingerprint);
  });

  it.each([
    ['numeric-looking key beyond array-index range', '4294967295'],
    ['negative key', '-1'],
    ['padded key', '01'],
    ['symbol key', Symbol('extra')],
  ] as const)(
    'rejects an enumerable array property outside dense indices: %s',
    (_name, extraKey) => {
      const entries = ['value'];
      const first = growthFormRequestSnapshot(null, { entries });
      Object.defineProperty(entries, extraKey, {
        configurable: true,
        enumerable: true,
        value: 'hidden',
        writable: true,
      });

      expect(() =>
        growthFormRequestSnapshot(first, { entries } as never)
      ).toThrow('Growth form facts must be JSON-safe');
    }
  );

  it('accepts and deeply freezes the recursive JSON facts contract', () => {
    const facts = {
      active: true,
      count: 2,
      email: 'reader@example.com',
      metadata: {
        empty: null,
        interests: ['angular', { agents: true }],
      },
    } satisfies GrowthFormFacts;

    const snapshot = growthFormRequestSnapshot(null, facts);

    expect(snapshot.facts).toEqual(facts);
    expect(Object.isFrozen(snapshot.facts)).toBe(true);
    expect(Object.isFrozen(snapshot.facts.metadata)).toBe(true);
    expect(Object.isFrozen(snapshot.facts.metadata.interests)).toBe(true);
    expect(Object.isFrozen(snapshot.facts.metadata.interests[1])).toBe(true);
  });

  it.each([
    [
      'cycle',
      () => {
        const value: Record<string, unknown> = {};
        value['self'] = value;
        return value;
      },
    ],
    ['bigint', () => ({ value: 1n })],
    ['undefined', () => ({ value: undefined })],
    ['function', () => ({ value: () => undefined })],
    ['symbol', () => ({ value: Symbol('value') })],
    ['undefined array entry', () => ({ value: [undefined] })],
    ['function array entry', () => ({ value: [() => undefined] })],
    ['symbol array entry', () => ({ value: [Symbol('value')] })],
    ['symbol key', () => ({ [Symbol('key')]: 'value' })],
    ['NaN', () => ({ value: Number.NaN })],
    ['positive infinity', () => ({ value: Number.POSITIVE_INFINITY })],
    ['negative infinity', () => ({ value: Number.NEGATIVE_INFINITY })],
    ['negative zero', () => ({ value: -0 })],
    ['Date', () => ({ value: new Date(0) })],
    ['Map', () => ({ value: new Map([['key', 'value']]) })],
    ['Set', () => ({ value: new Set(['value']) })],
    [
      'class instance',
      () => ({
        value: new (class FormFact {
          readonly value = 'value';
        })(),
      }),
    ],
    ['null-prototype object', () => ({ value: Object.create(null) })],
    [
      'non-enumerable property',
      () => {
        const value = {};
        Object.defineProperty(value, 'hidden', { value: 'hidden' });
        return { value };
      },
    ],
    [
      'sparse array',
      () => {
        const value = new Array(2) as unknown[];
        value[1] = 'value';
        return { value };
      },
    ],
  ] as const)(
    'rejects non-JSON facts without coercion: %s',
    (_name, create) => {
      expect(() => growthFormRequestSnapshot(null, create() as never)).toThrow(
        'Growth form facts must be JSON-safe'
      );
    }
  );

  it('uses one closed snapshot error without echoing fact keys or values', () => {
    let message = '';
    try {
      growthFormRequestSnapshot(null, {
        private_field_name: undefined,
        visible: 'private-field-value',
      } as never);
    } catch (error) {
      message = String(error);
    }

    expect(message).toBe('Error: Growth form facts must be JSON-safe');
    expect(message).not.toContain('private_field_name');
    expect(message).not.toContain('private-field-value');
  });
});
