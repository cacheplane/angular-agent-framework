module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Require a scope on every commit. Allowlist maps to the monorepo's public
    // surface area; `repo` and `deps` are escape hatches for cross-cutting or
    // dependency-bump commits.
    'scope-enum': [
      2,
      'always',
      [
        'agent',
        'render',
        'chat',
        'website',
        'cockpit',
        'release',
        'deps',
        'ci',
        'docs',
        'repo',
      ],
    ],
    // Override upstream default (warn) to enforce as an error at the same limit.
    'header-max-length': [2, 'always', 100],
  },
};
