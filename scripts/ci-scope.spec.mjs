// SPDX-License-Identifier: MIT
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyFromAffected,
  emptyScope,
  fullScope,
  hasGlobalCiFileChange,
  isAngularCompatibilityChange,
  SCOPE_KEYS,
} from './ci-scope.mjs';

const PUBLISHABLE_LIB_TAGS = [
  'scope:angular-compatibility',
  'scope:library',
  'scope:website',
  'scope:website-e2e',
  'scope:cockpit',
  'scope:cockpit-examples',
  'scope:cockpit-smoke',
  'scope:cockpit-deploy-smoke',
  'scope:cockpit-e2e',
  'scope:examples-chat',
];
const COCKPIT_CAP_ANGULAR_TAGS = [
  'scope:cockpit-examples',
  'scope:cockpit-e2e',
];
const COCKPIT_CAP_PYTHON_TAGS = [
  'scope:cockpit-examples',
  'scope:cockpit-e2e',
  'scope:cockpit-smoke',
];
const WEBSITE_TAGS = ['scope:website', 'scope:website-e2e'];
const COCKPIT_APP_TAGS = [
  'scope:cockpit',
  'scope:cockpit-examples',
  'scope:cockpit-deploy-smoke',
  'scope:cockpit-e2e',
];
const EXAMPLES_CHAT_TAGS = [
  'scope:angular-compatibility',
  'scope:examples-chat',
];
const POSTHOG_TAGS = ['scope:posthog'];

describe('Angular compatibility project tags', () => {
  for (const projectFile of [
    'libs/chat/project.json',
    'libs/langgraph/project.json',
    'libs/ag-ui/project.json',
    'libs/render/project.json',
    'libs/a2ui/project.json',
    'libs/telemetry/project.json',
    'examples/chat/angular/project.json',
    'examples/chat/smoke/project.json',
  ]) {
    it(`${projectFile} owns the Angular compatibility scope`, async () => {
      const project = JSON.parse(await readFile(projectFile, 'utf8'));

      assert.ok(project.tags?.includes('scope:angular-compatibility'));
    });
  }
});

describe('classifyFromAffected — short-circuit', () => {
  it('detects global CI files before affected project lookup is needed', () => {
    assert.equal(hasGlobalCiFileChange(['nx.json']), true);
    assert.equal(hasGlobalCiFileChange(['libs/chat/src/foo.ts']), false);
  });

  it('returns full scope when a global CI file changes', () => {
    const scope = classifyFromAffected(['.github/workflows/ci.yml'], []);
    assert.deepEqual(scope, fullScope());
  });

  it('full scope on package.json change', () => {
    assert.deepEqual(classifyFromAffected(['package.json'], []), fullScope());
  });

  it('empty scope when no global file + no affected projects', () => {
    assert.deepEqual(
      classifyFromAffected(['docs/some-readme.md'], []),
      emptyScope()
    );
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
    // E2e / smoke / deploy / posthog scopes: false
    assert.equal(scope.website_e2e, false);
    assert.equal(scope.cockpit_e2e, false);
    assert.equal(scope.cockpit_smoke, false);
    assert.equal(scope.cockpit_examples, false);
    assert.equal(scope.cockpit_deploy_smoke, false);
    assert.equal(scope.posthog, false);
  });

  it('eslint.config.mjs alongside an affected project still ORs in the project scopes', () => {
    const scope = classifyFromAffected(
      ['eslint.config.mjs', 'cockpit/chat/messages/python/src/graph.py'],
      [
        {
          name: 'cockpit-chat-messages-python',
          tags: [
            'scope:cockpit-e2e',
            'scope:cockpit-examples',
            'scope:cockpit-smoke',
          ],
        },
      ]
    );
    assert.equal(scope.library, true);
    assert.equal(scope.cockpit_e2e, true);
    assert.equal(scope.cockpit_examples, true);
    assert.equal(scope.cockpit_smoke, true);
  });
});

describe('classifyFromAffected — publishable lib broadcast', () => {
  it('publishable lib triggers its existing scopes plus angular compatibility', () => {
    const scope = classifyFromAffected(
      ['libs/chat/src/foo.ts'],
      [{ name: 'chat', tags: PUBLISHABLE_LIB_TAGS }]
    );
    assert.equal(scope.library, true);
    assert.equal(scope.website, true);
    assert.equal(scope.website_e2e, true);
    assert.equal(scope.cockpit, true);
    assert.equal(scope.cockpit_examples, true);
    assert.equal(scope.cockpit_smoke, true);
    assert.equal(scope.cockpit_deploy_smoke, true);
    assert.equal(scope.cockpit_e2e, true);
    assert.equal(scope.examples_chat, true);
    assert.equal(scope.angular_compatibility, true);
    assert.equal(scope.posthog, false);
  });
});

describe('classifyFromAffected — Angular compatibility', () => {
  for (const projectName of ['examples-chat-angular', 'examples-chat-smoke']) {
    it(`${projectName} triggers Angular compatibility without unrelated scopes`, () => {
      const scope = classifyFromAffected(
        [
          `examples/chat/${
            projectName === 'examples-chat-angular'
              ? 'angular/src/app/app.ts'
              : 'smoke/cli.mjs'
          }`,
        ],
        [{ name: projectName, tags: EXAMPLES_CHAT_TAGS }]
      );

      assert.equal(scope.angular_compatibility, true);
      assert.equal(scope.examples_chat, true);
      for (const key of SCOPE_KEYS) {
        if (key === 'angular_compatibility' || key === 'examples_chat')
          continue;
        assert.equal(scope[key], false, `${key} should remain false`);
      }
    });
  }

  it('website-only and PostHog changes leave Angular compatibility false', () => {
    const websiteScope = classifyFromAffected(
      ['apps/website/src/app/page.tsx'],
      [{ name: 'website', tags: WEBSITE_TAGS }]
    );
    const posthogScope = classifyFromAffected(
      ['tools/posthog/src/dashboards.ts'],
      [{ name: 'posthog-tools', tags: POSTHOG_TAGS }]
    );

    assert.equal(websiteScope.angular_compatibility, false);
    assert.equal(posthogScope.angular_compatibility, false);
  });

  it('global CI files include Angular compatibility in full scope', () => {
    assert.equal(
      classifyFromAffected(['.github/workflows/ci.yml'], [])
        .angular_compatibility,
      true
    );
  });
});

describe('isAngularCompatibilityChange', () => {
  const exactFiles = [
    'scripts/verify-angular-support.mjs',
    'scripts/verify-angular-support.spec.mjs',
    'libs/chat/package.json',
    'libs/langgraph/package.json',
    'libs/ag-ui/package.json',
    'libs/render/package.json',
    'libs/telemetry/package.json',
    'libs/cockpit-telemetry/package.json',
    'libs/example-layouts/package.json',
    'apps/website/src/components/pricing/angular-support.mjs',
    'apps/website/src/components/pricing/CompatibilityMatrix.tsx',
    'apps/website/src/components/pricing/PricingDetails.tsx',
    'README.md',
    'libs/chat/README.md',
    'libs/langgraph/README.md',
    'libs/ag-ui/README.md',
    'libs/render/README.md',
    'libs/telemetry/README.md',
    'apps/website/content/docs/chat/getting-started/installation.mdx',
    'apps/website/content/docs/langgraph/getting-started/installation.mdx',
    'apps/website/content/docs/ag-ui/getting-started/installation.mdx',
    'apps/website/content/docs/render/getting-started/installation.mdx',
  ];

  for (const file of exactFiles) {
    it(`directly selects Angular compatibility for ${file}`, () => {
      assert.equal(isAngularCompatibilityChange([file]), true);
      assert.equal(
        classifyFromAffected([file], []).angular_compatibility,
        true
      );
    });
  }

  for (const file of [
    'examples/chat/smoke/template/package.json',
    'examples/chat/angular/src/app/app.ts',
  ]) {
    it(`selects Angular compatibility for files below ${file}`, () => {
      assert.equal(isAngularCompatibilityChange([file]), true);
      assert.equal(
        classifyFromAffected([file], []).angular_compatibility,
        true
      );
    });
  }

  it('does not select unrelated files', () => {
    assert.equal(
      isAngularCompatibilityChange(['apps/website/src/app/page.tsx']),
      false
    );
  });
});

describe('classifyFromAffected — cockpit cap projects', () => {
  it('cockpit cap python triggers cockpit_e2e + cockpit_examples + cockpit_smoke', () => {
    const scope = classifyFromAffected(
      ['cockpit/chat/messages/python/src/graph.py'],
      [{ name: 'cockpit-chat-messages-python', tags: COCKPIT_CAP_PYTHON_TAGS }]
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
      [
        {
          name: 'cockpit-chat-messages-angular',
          tags: COCKPIT_CAP_ANGULAR_TAGS,
        },
      ]
    );
    assert.equal(scope.cockpit_e2e, true);
    assert.equal(scope.cockpit_examples, true);
    assert.equal(scope.cockpit_smoke, false);
  });
});

describe('classifyFromAffected — apps + fallback paths via namedInputs', () => {
  it('vercel.json change marks apps/website affected → website + website_e2e', () => {
    const scope = classifyFromAffected(
      ['vercel.json'],
      [{ name: 'website', tags: WEBSITE_TAGS }]
    );
    assert.equal(scope.website, true);
    assert.equal(scope.website_e2e, true);
    assert.equal(scope.cockpit, false);
  });

  it('capability-registry.ts change marks apps/cockpit affected → all cockpit_*', () => {
    const scope = classifyFromAffected(
      ['apps/cockpit/scripts/capability-registry.ts'],
      [{ name: 'cockpit', tags: COCKPIT_APP_TAGS }]
    );
    assert.equal(scope.cockpit, true);
    assert.equal(scope.cockpit_examples, true);
    assert.equal(scope.cockpit_deploy_smoke, true);
    assert.equal(scope.cockpit_e2e, true);
  });

  it('examples/chat change → examples_chat only', () => {
    const scope = classifyFromAffected(
      ['examples/chat/angular/src/main.ts'],
      [{ name: 'examples-chat-angular', tags: EXAMPLES_CHAT_TAGS }]
    );
    assert.equal(scope.examples_chat, true);
    assert.equal(scope.cockpit, false);
  });

  it('tools/posthog change → posthog only', () => {
    const scope = classifyFromAffected(
      ['tools/posthog/src/dashboards.ts'],
      [{ name: 'posthog-tools', tags: POSTHOG_TAGS }]
    );
    assert.equal(scope.posthog, true);
    assert.equal(scope.library, false);
  });
});

describe('classifyFromAffected — tag isolation', () => {
  it('tags not prefixed with "scope:" are ignored', () => {
    const scope = classifyFromAffected(
      ['some.ts'],
      [{ name: 'x', tags: ['type:app', 'rotation:weekly'] }]
    );
    assert.deepEqual(scope, emptyScope());
  });

  it('unknown scope tags are ignored (no key collision)', () => {
    const scope = classifyFromAffected(
      ['some.ts'],
      [{ name: 'x', tags: ['scope:not-a-real-scope'] }]
    );
    assert.deepEqual(scope, emptyScope());
  });
});

describe('SCOPE_KEYS export', () => {
  it('contains the 12 documented scope keys', () => {
    assert.deepEqual(SCOPE_KEYS, [
      'library',
      'angular_compatibility',
      'website',
      'website_e2e',
      'cockpit',
      'cockpit_examples',
      'cockpit_smoke',
      'cockpit_deploy_smoke',
      'cockpit_e2e',
      'examples_chat',
      'posthog',
      'scripts_tests',
    ]);
  });
});
