export type FixtureId = 'atlas' | 'beacon';

const corpus = {
  atlas: { name: 'Atlas Synthetic', observation: 'Synthetic fixture documents an Angular evaluation.', source: 'fixture:atlas:v1' },
  beacon: { name: 'Beacon Synthetic', observation: 'Synthetic fixture documents a support prototype.', source: 'fixture:beacon:v1' },
} as const;

export function assertFixtureMode(): void {
  if (process.env['GROWTH_RESEARCH_FIXTURE_MODE'] !== 'synthetic-only') {
    throw new Error('Growth research fixture mode is disabled');
  }
}

export function readSyntheticFixture(fixtureId: FixtureId) {
  assertFixtureMode();
  if (fixtureId !== 'atlas' && fixtureId !== 'beacon') throw new Error('Unknown synthetic fixture');
  return { fixtureId, ...corpus[fixtureId] };
}
