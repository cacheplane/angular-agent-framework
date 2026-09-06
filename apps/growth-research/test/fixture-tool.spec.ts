import { afterEach, expect, it, vi } from 'vitest';
import readFixture from '../src/tools/readFixture.js';

afterEach(() => vi.unstubAllEnvs());

it('aborts a paused fixture tool without producing later fixture output', async () => {
  vi.stubEnv('GROWTH_RESEARCH_FIXTURE_MODE', 'synthetic-only');
  vi.stubEnv('GROWTH_RESEARCH_FIXTURE_DELAY_MS', '5000');
  const controller = new AbortController();
  let produced = false;
  const result = Promise.resolve(readFixture({ fixtureId: 'atlas' }, { signal: controller.signal })).then(value => { produced = true; return value; });
  controller.abort();
  await expect(result).rejects.toThrow(/abort/i);
  expect(produced).toBe(false);
});

it.each(['-1', '5001', 'NaN', '1.5'])('rejects invalid server-owned fixture delays: %s', async delay => {
  vi.stubEnv('GROWTH_RESEARCH_FIXTURE_MODE', 'synthetic-only');
  vi.stubEnv('GROWTH_RESEARCH_FIXTURE_DELAY_MS', delay);
  await expect(Promise.resolve().then(() => readFixture({ fixtureId: 'atlas' }, { signal: new AbortController().signal }))).rejects.toThrow(/fixture delay/i);
});
