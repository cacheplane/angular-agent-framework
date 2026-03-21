export const COCKPIT_SMOKE_ASSERTION_STATUSES = ['pending', 'pass', 'fail'] as const;

export type CockpitSmokeAssertionStatus = (typeof COCKPIT_SMOKE_ASSERTION_STATUSES)[number];

export interface CockpitSmokeAssertion {
  name: string;
  target: string;
  description: string;
  status: CockpitSmokeAssertionStatus;
}

export interface CockpitSmokeHarnessContract {
  name: string;
  assertions: readonly CockpitSmokeAssertion[];
}
