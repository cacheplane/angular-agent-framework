// SPDX-License-Identifier: MIT
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyFromAffected,
  emptyScope,
  fullScope,
  SCOPE_KEYS,
} from './ci-scope.mjs';

const PUBLISHABLE_LIB_TAGS = [
  'scope:library', 'scope:website', 'scope:website-e2e',
  'scope:cockpit', 'scope:cockpit-examples', 'scope:cockpit-smoke',
  'scope:cockpit-secret', 'scope:cockpit-deploy-smoke',
  'scope:cockpit-e2e', 'scope:examples-chat',
];
const COCKPIT_CAP_ANGULAR_TAGS = ['scope:cockpit-examples', 'scope:cockpit-e2e'];
const COCKPIT_CAP_PYTHON_TAGS = ['scope:cockpit-examples', 'scope:cockpit-e2e', 'scope:cockpit-smoke'];
const WEBSITE_TAGS = ['scope:website', 'scope:website-e2e'];
const COCKPIT_APP_TAGS = ['scope:cockpit', 'scope:cockpit-examples', 'scope:cockpit-deploy-smoke', 'scope:cockpit-e2e'];
const EXAMPLES_CHAT_TAGS = ['scope:examples-chat'];
const POSTHOG_TAGS = ['scope:posthog'];

describe('classifyFromAffected — short-circuit', () => {
  it('returns full scope when a global CI file changes', () => {
    const scope = classifyFromAffected(['.github/workflows/ci.yml'], []);
    assert.deepEqual(scope, fullScope());
  });

  it('full scope on package.json change', () => {
    assert.deepEqual(classifyFromAffected(['package.json'], []), fullScope());
  });

  it('empty scope when no global file + no affected projects', () => {
    assert.deepEqual(classifyFromAffected(['docs/some-readme.md'], []), emptyScope());
  });
});

describe('classifyFromAffected — lint-only files', () => {
  it('eslint.config.mjs flips only lint-running scopes, NOT e2e/smoke/deploy', () => {
    const scope = classifyFromAffected(['eslint.config.mjs'], []);
    // Lint-running scopes: true
    assert.equal(scope.library, true);
    assert.equal(scope.cockpit, true);
    assert.equal(scope.website, true);
    assert.equal(scope.examples_chat, true);
    // E2e / smoke / deploy / secret / posthog scopes: false
    assert.equal(scope.website_e2e, false);
    assert.equal(scope.cockpit_e2e, false);
    assert.equal(scope.cockpit_smoke, false);
    assert.equal(scope.cockpit_examples, false);
    assert.equal(scope.cockpit_secret, false);
    assert.equal(scope.cockpit_deploy_smoke, false);
    assert.equal(scope.posthog, false);
  });

  it('eslint.config.mjs alongside an affected project still ORs in the project scopes', () => {
    const scope = classifyFromAffected(
      ['eslint.config.mjs', 'cockpit/chat/messages/python/src/graph.py'],
      [{ name: 'cockpit-chat-messages-python', tags: ['scope:cockpit-e2e', 'scope:cockpit-examples', 'scope:cockpit-smoke'] }],
    );
    assert.equal(scope.library, true);
    assert.equal(scope.cockpit_e2e, true);
    assert.equal(scope.cockpit_examples, true);
    assert.equal(scope.cockpit_smoke, true);
  });
});

describe('classifyFromAffected — publishable lib broadcast', () => {
  it('publishable lib triggers library + website + website_e2e + cockpit_* + examples_chat', () => {
    const scope = classifyFromAffected(['libs/chat/src/foo.ts'], [
      { name: 'chat', tags: PUBLISHABLE_LIB_TAGS },
    ]);
    assert.equal(scope.library, true);
    assert.equal(scope.website, true);
    assert.equal(scope.website_e2e, true);
    assert.equal(scope.cockpit, true);
    assert.equal(scope.cockpit_examples, true);
    assert.equal(scope.cockpit_smoke, true);
    assert.equal(scope.cockpit_secret, true);
    assert.equal(scope.cockpit_deploy_smoke, true);
    assert.equal(scope.cockpit_e2e, true);
    assert.equal(scope.examples_chat, true);
    assert.equal(scope.posthog, false);
  });
});

describe('classifyFromAffected — cockpit cap projects', () => {
  it('cockpit cap python triggers cockpit_e2e + cockpit_examples + cockpit_smoke', () => {
    const scope = classifyFromAffected(
      ['cockpit/chat/messages/python/src/graph.py'],
      [{ name: 'cockpit-chat-messages-python', tags: COCKPIT_CAP_PYTHON_TAGS }],
    );
    assert.equal(scope.cockpit_e2e, true);
    assert.equal(scope.cockpit_examples, true);
    assert.equal(scope.cockpit_smoke, true);
    assert.equal(scope.cockpit, false);
    assert.equal(scope.library, false);
  });

  it('cockpit cap angular triggers cockpit_e2e + cockpit_examples only', () => {
    const scope = classifyFromAffected(
      ['cockpit/chat/messages/angular/src/main.ts'],
      [{ name: 'cockpit-chat-messages-angular', tags: COCKPIT_CAP_ANGULAR_TAGS }],
    );
    assert.equal(scope.cockpit_e2e, true);
    assert.equal(scope.cockpit_examples, true);
    assert.equal(scope.cockpit_smoke, false);
  });
});

describe('classifyFromAffected — apps + fallback paths via namedInputs', () => {
  it('vercel.json change marks apps/website affected → website + website_e2e', () => {
    const scope = classifyFromAffected(['vercel.json'], [
      { name: 'website', tags: WEBSITE_TAGS },
    ]);
    assert.equal(scope.website, true);
    assert.equal(scope.website_e2e, true);
    assert.equal(scope.cockpit, false);
  });

  it('capability-registry.ts change marks apps/cockpit affected → all cockpit_*', () => {
    const scope = classifyFromAffected(
      ['apps/cockpit/scripts/capability-registry.ts'],
      [{ name: 'cockpit', tags: COCKPIT_APP_TAGS }],
    );
    assert.equal(scope.cockpit, true);
    assert.equal(scope.cockpit_examples, true);
    assert.equal(scope.cockpit_deploy_smoke, true);
    assert.equal(scope.cockpit_e2e, true);
  });

  it('examples/chat change → examples_chat only', () => {
    const scope = classifyFromAffected(
      ['examples/chat/angular/src/main.ts'],
      [{ name: 'examples-chat-angular', tags: EXAMPLES_CHAT_TAGS }],
    );
    assert.equal(scope.examples_chat, true);
    assert.equal(scope.cockpit, false);
  });

  it('tools/posthog change → posthog only', () => {
    const scope = classifyFromAffected(
      ['tools/posthog/src/dashboards.ts'],
      [{ name: 'posthog-tools', tags: POSTHOG_TAGS }],
    );
    assert.equal(scope.posthog, true);
    assert.equal(scope.library, false);
  });
});

describe('classifyFromAffected — tag isolation', () => {
  it('tags not prefixed with "scope:" are ignored', () => {
    const scope = classifyFromAffected(['some.ts'], [
      { name: 'x', tags: ['type:app', 'rotation:weekly'] },
    ]);
    assert.deepEqual(scope, emptyScope());
  });

  it('unknown scope tags are ignored (no key collision)', () => {
    const scope = classifyFromAffected(['some.ts'], [
      { name: 'x', tags: ['scope:not-a-real-scope'] },
    ]);
    assert.deepEqual(scope, emptyScope());
  });
});

describe('SCOPE_KEYS export', () => {
  it('contains the 11 documented scope keys', () => {
    assert.deepEqual(SCOPE_KEYS, [
      'library', 'website', 'website_e2e',
      'cockpit', 'cockpit_examples', 'cockpit_smoke',
      'cockpit_secret', 'cockpit_deploy_smoke', 'cockpit_e2e',
      'examples_chat', 'posthog',
    ]);
  });
});
