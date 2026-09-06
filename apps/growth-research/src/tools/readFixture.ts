import { setTimeout } from 'node:timers/promises';
import { assertFixtureMode, readSyntheticFixture, type FixtureId } from '../runtime/fixture-contract.js';

/** Read one compiled synthetic fixture. No network or filesystem access. */
export default async function readFixture(input: { fixtureId: FixtureId }, context: { signal: AbortSignal }) {
  assertFixtureMode();
  const configured = process.env['GROWTH_RESEARCH_FIXTURE_DELAY_MS'] ?? '0';
  if (!/^\d+$/.test(configured) || Number(configured) > 5000) throw new Error('Invalid fixture delay; expected an integer from 0 to 5000 milliseconds');
  const delay = Number(configured);
  context.signal.throwIfAborted();
  if (delay > 0) await setTimeout(delay, undefined, { signal: context.signal });
  context.signal.throwIfAborted();
  assertFixtureMode();
  return readSyntheticFixture(input.fixtureId);
}
