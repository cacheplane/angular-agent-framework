'use strict';
const truthy = (value) =>
  typeof value === 'string' && /^(1|true|yes)$/i.test(value.trim());
function disabled(env) {
  return [
    'DO_NOT_TRACK',
    'npm_config_do_not_track',
    'NPM_CONFIG_DO_NOT_TRACK',
    'TPLANE_TELEMETRY_DISABLED',
  ].some((key) => truthy(env[key]));
}
function packageManager(agent) {
  const match =
    typeof agent === 'string' &&
    agent.length <= 1024 &&
    /^(npm|pnpm|yarn|bun)\/([0-9][a-zA-Z0-9.+-]{0,63})(?:\s|$)/.exec(agent);
  return match
    ? { packageManager: match[1], packageManagerVersion: match[2] }
    : { packageManager: 'unknown' };
}
function environment(env, interactive, manager) {
  const indicators = [
    ['github_actions', truthy(env.GITHUB_ACTIONS)],
    ['gitlab_ci', truthy(env.GITLAB_CI)],
    [
      'jenkins',
      typeof env.JENKINS_URL === 'string' && env.JENKINS_URL.length > 0,
    ],
    ['travis', truthy(env.TRAVIS)],
    ['circleci', truthy(env.CIRCLECI)],
    ['bitbucket', /^\d+$/.test(env.BITBUCKET_BUILD_NUMBER ?? '')],
    ['buildkite', truthy(env.BUILDKITE)],
    [
      'generic_ci',
      ['CI', 'CONTINUOUS_INTEGRATION', 'VERCEL', 'TF_BUILD'].some((key) =>
        truthy(env[key])
      ),
    ],
  ];
  const provider = indicators.find(([, present]) => present)?.[0];
  if (provider)
    return {
      environment: 'ci',
      environmentEvidence: provider,
      ciProvider: provider,
    };
  if (interactive && manager !== 'unknown')
    return {
      environment: 'local',
      environmentEvidence: 'interactive_package_manager',
    };
  return { environment: 'unknown', environmentEvidence: 'unknown' };
}
module.exports = { truthy, disabled, packageManager, environment };
