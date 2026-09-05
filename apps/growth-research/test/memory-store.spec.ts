import { afterEach, expect, it, vi } from 'vitest';
import { createDurableMemoryStore, syntheticEmbedder, trustedFixtureScope } from '../src/runtime/memory-store.js';

afterEach(() => vi.unstubAllEnvs());

it('constructs without credentials but refuses runtime storage with no database', async () => {
  vi.stubEnv('DAWN_DATABASE_URL', '');
  const store = createDurableMemoryStore();
  await expect(store.search({ namespace: 'synthetic' })).rejects.toThrow(/DAWN_DATABASE_URL is required/);
  await store.close();
});

it('returns the mathematically empty zero-limit index without opening a database', async () => {
  vi.stubEnv('DAWN_DATABASE_URL', '');
  const store = createDurableMemoryStore();
  await expect(store.search({ namespace: 'synthetic', limit: 0 })).resolves.toEqual([]);
  await expect(store.search({ namespace: 'synthetic', limit: 1 })).rejects.toThrow(/DAWN_DATABASE_URL is required/);
  await store.close();
});

it('uses deterministic finite vectors with the declared dimensions', async () => {
  const [first, repeated, other] = await syntheticEmbedder.embed(['atlas', 'atlas', 'beacon']);
  expect(Array.from(first)).toHaveLength(8);
  expect(Array.from(first)).toEqual(Array.from(repeated));
  expect(Array.from(first)).not.toEqual(Array.from(other));
  expect(Array.from(first).every(Number.isFinite)).toBe(true);
});

it('accepts only a trusted closed fixture slot for memory addressing', () => {
  vi.stubEnv('GROWTH_RESEARCH_FIXTURE_SLOT', 'beacon');
  expect(trustedFixtureScope()).toEqual({ workspace: 'growth-research', agent: 'beacon' });
  vi.stubEnv('GROWTH_RESEARCH_FIXTURE_SLOT', 'external-tenant');
  expect(() => trustedFixtureScope()).toThrow(/fixture slot/);
});
