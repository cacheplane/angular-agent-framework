// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
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
    expect(scope).toEqual(fullScope());
  });

  it('full scope on package.json change', () => {
    expect(classifyFromAffected(['package.json'], [])).toEqual(fullScope());
  });

  it('empty scope when no global file + no affected projects', () => {
    expect(classifyFromAffected(['docs/some-readme.md'], [])).toEqual(emptyScope());
  });
});

describe('classifyFromAffected — publishable lib broadcast', () => {
  it('publishable lib triggers library + website + website_e2e + cockpit_* + examples_chat', () => {
    const scope = classifyFromAffected(['libs/chat/src/foo.ts'], [
      { name: 'chat', tags: PUBLISHABLE_LIB_TAGS },
    ]);
    expect(scope.library).toBe(true);
    expect(scope.website).toBe(true);
    expect(scope.website_e2e).toBe(true);
    expect(scope.cockpit).toBe(true);
    expect(scope.cockpit_examples).toBe(true);
    expect(scope.cockpit_smoke).toBe(true);
    expect(scope.cockpit_secret).toBe(true);
    expect(scope.cockpit_deploy_smoke).toBe(true);
    expect(scope.cockpit_e2e).toBe(true);
    expect(scope.examples_chat).toBe(true);
    expect(scope.posthog).toBe(false);
  });
});

describe('classifyFromAffected — cockpit cap projects', () => {
  it('cockpit cap python triggers cockpit_e2e + cockpit_examples + cockpit_smoke', () => {
    const scope = classifyFromAffected(
      ['cockpit/chat/messages/python/src/graph.py'],
      [{ name: 'cockpit-chat-messages-python', tags: COCKPIT_CAP_PYTHON_TAGS }],
    );
    expect(scope.cockpit_e2e).toBe(true);
    expect(scope.cockpit_examples).toBe(true);
    expect(scope.cockpit_smoke).toBe(true);
    expect(scope.cockpit).toBe(false);
    expect(scope.library).toBe(false);
  });

  it('cockpit cap angular triggers cockpit_e2e + cockpit_examples only', () => {
    const scope = classifyFromAffected(
      ['cockpit/chat/messages/angular/src/main.ts'],
      [{ name: 'cockpit-chat-messages-angular', tags: COCKPIT_CAP_ANGULAR_TAGS }],
    );
    expect(scope.cockpit_e2e).toBe(true);
    expect(scope.cockpit_examples).toBe(true);
    expect(scope.cockpit_smoke).toBe(false);
  });
});

describe('classifyFromAffected — apps + fallback paths via namedInputs', () => {
  it('vercel.json change marks apps/website affected → website + website_e2e', () => {
    const scope = classifyFromAffected(['vercel.json'], [
      { name: 'website', tags: WEBSITE_TAGS },
    ]);
    expect(scope.website).toBe(true);
    expect(scope.website_e2e).toBe(true);
    expect(scope.cockpit).toBe(false);
  });

  it('capability-registry.ts change marks apps/cockpit affected → all cockpit_*', () => {
    const scope = classifyFromAffected(
      ['apps/cockpit/scripts/capability-registry.ts'],
      [{ name: 'cockpit', tags: COCKPIT_APP_TAGS }],
    );
    expect(scope.cockpit).toBe(true);
    expect(scope.cockpit_examples).toBe(true);
    expect(scope.cockpit_deploy_smoke).toBe(true);
    expect(scope.cockpit_e2e).toBe(true);
  });

  it('examples/chat change → examples_chat only', () => {
    const scope = classifyFromAffected(
      ['examples/chat/angular/src/main.ts'],
      [{ name: 'examples-chat-angular', tags: EXAMPLES_CHAT_TAGS }],
    );
    expect(scope.examples_chat).toBe(true);
    expect(scope.cockpit).toBe(false);
  });

  it('tools/posthog change → posthog only', () => {
    const scope = classifyFromAffected(
      ['tools/posthog/src/dashboards.ts'],
      [{ name: 'posthog-tools', tags: POSTHOG_TAGS }],
    );
    expect(scope.posthog).toBe(true);
    expect(scope.library).toBe(false);
  });
});

describe('classifyFromAffected — tag isolation', () => {
  it('tags not prefixed with "scope:" are ignored', () => {
    const scope = classifyFromAffected(['some.ts'], [
      { name: 'x', tags: ['type:app', 'rotation:weekly'] },
    ]);
    expect(scope).toEqual(emptyScope());
  });

  it('unknown scope tags are ignored (no key collision)', () => {
    const scope = classifyFromAffected(['some.ts'], [
      { name: 'x', tags: ['scope:not-a-real-scope'] },
    ]);
    expect(scope).toEqual(emptyScope());
  });
});

describe('SCOPE_KEYS export', () => {
  it('contains the 11 documented scope keys', () => {
    expect(SCOPE_KEYS).toEqual([
      'library', 'website', 'website_e2e',
      'cockpit', 'cockpit_examples', 'cockpit_smoke',
      'cockpit_secret', 'cockpit_deploy_smoke', 'cockpit_e2e',
      'examples_chat', 'posthog',
    ]);
  });
});
