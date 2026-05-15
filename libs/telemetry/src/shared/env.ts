const TRUE_VALUES = new Set(['1', 'true', 'TRUE', 'yes']);

function truthy(v: string | undefined): boolean {
  return v !== undefined && TRUE_VALUES.has(v);
}

type DisableReason = 'DO_NOT_TRACK' | 'NGAF_TELEMETRY_DISABLED' | 'CI' | null;

export function getDisableReason(env: NodeJS.ProcessEnv = process.env): DisableReason {
  if (truthy(env.DO_NOT_TRACK) || truthy(env.npm_config_do_not_track) || truthy(env.NPM_CONFIG_DO_NOT_TRACK)) {
    return 'DO_NOT_TRACK';
  }
  if (truthy(env.NGAF_TELEMETRY_DISABLED)) return 'NGAF_TELEMETRY_DISABLED';
  if (
    truthy(env.CI) ||
    truthy(env.GITHUB_ACTIONS) ||
    truthy(env.CONTINUOUS_INTEGRATION) ||
    truthy(env.BUILDKITE) ||
    truthy(env.CIRCLECI)
  ) {
    return 'CI';
  }
  return null;
}

export function isTelemetryDisabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return getDisableReason(env) !== null;
}
