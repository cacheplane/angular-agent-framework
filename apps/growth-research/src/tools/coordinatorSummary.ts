import { readSyntheticFixture, type FixtureId } from '../runtime/fixture-contract.js';

/** Produce a coordinator-only synthetic summary of the fixed corpus. */
export default function coordinatorSummary(input: { fixtureId: FixtureId }) {
  return { label: 'coordinator-only synthetic summary', evidence: readSyntheticFixture(input.fixtureId) };
}
