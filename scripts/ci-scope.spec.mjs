import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyChangedFiles } from './ci-scope.mjs';

const projects = [
  {
    name: 'chat',
    root: 'libs/chat',
    sourceRoot: 'libs/chat/src',
    projectType: 'library',
    tags: [],
    targets: { build: {}, lint: {}, test: {} },
  },
  {
    name: 'website',
    root: 'apps/website',
    sourceRoot: 'apps/website/src',
    projectType: 'application',
    tags: ['scope:website', 'type:app'],
    targets: { build: {}, e2e: {}, lint: {} },
  },
  {
    name: 'cockpit-new-cap-angular',
    root: 'cockpit/new/cap/angular',
    sourceRoot: 'cockpit/new/cap/angular/src',
    projectType: 'application',
    tags: [],
    targets: { build: {}, e2e: {}, smoke: {} },
  },
  {
    name: 'cockpit-new-cap-python',
    root: 'cockpit/new/cap/python',
    sourceRoot: 'cockpit/new/cap/python/src',
    projectType: 'library',
    tags: [],
    targets: { build: {}, smoke: {}, integration: {} },
  },
  {
    name: 'posthog-tools',
    root: 'tools/posthog',
    sourceRoot: 'tools/posthog',
    projectType: 'library',
    tags: ['scope:gtm', 'type:tool'],
    targets: { 'sync:plan': {}, 'quality:live': {} },
  },
  {
    name: 'e2e-harness',
    root: 'libs/e2e-harness',
    sourceRoot: 'libs/e2e-harness/src',
    projectType: 'library',
    tags: [],
    targets: { build: {} },
  },
];

const workspace = {
  projects,
  publishableProjects: ['chat'],
};

test('publishable library changes fan out to dependent product checks', () => {
  const scope = classifyChangedFiles(['libs/chat/src/public-api.ts'], workspace);

  assert.equal(scope.library, true);
  assert.equal(scope.website, true);
  assert.equal(scope.website_e2e, true);
  assert.equal(scope.cockpit, true);
  assert.equal(scope.cockpit_examples, true);
  assert.equal(scope.cockpit_smoke, true);
  assert.equal(scope.cockpit_secret, true);
  assert.equal(scope.cockpit_deploy_smoke, true);
  assert.equal(scope.examples_chat, true);
  assert.equal(scope.cockpit_e2e, true);
  assert.equal(scope.posthog, false);
});

test('cockpit angular project metadata drives examples and e2e scope', () => {
  const scope = classifyChangedFiles(['cockpit/new/cap/angular/src/app/app.ts'], workspace);

  assert.equal(scope.cockpit_examples, true);
  assert.equal(scope.cockpit_e2e, true);
  assert.equal(scope.cockpit_smoke, false);
});

test('cockpit python project changes trigger smoke + secret + examples + e2e', () => {
  const scope = classifyChangedFiles(['cockpit/new/cap/python/src/index.ts'], workspace);
  assert.equal(scope.cockpit_smoke, true);
  assert.equal(scope.cockpit_secret, true);
  assert.equal(scope.cockpit_examples, true);
  assert.equal(scope.cockpit_e2e, true);
});

test('PostHog project metadata drives PostHog scope', () => {
  const scope = classifyChangedFiles(['tools/posthog/live-quality.ts'], workspace);

  assert.equal(scope.posthog, true);
  assert.equal(scope.library, false);
  assert.equal(scope.website, false);
});

test('shared cockpit support libraries preserve conservative cockpit coverage', () => {
  const scope = classifyChangedFiles(['libs/e2e-harness/src/index.ts'], workspace);

  assert.equal(scope.cockpit, true);
  assert.equal(scope.cockpit_examples, true);
  assert.equal(scope.cockpit_deploy_smoke, true);
  assert.equal(scope.cockpit_e2e, true);
});

test('global CI config changes keep full PR coverage', () => {
  const scope = classifyChangedFiles(['.github/workflows/ci.yml'], workspace);

  assert.deepEqual(Object.values(scope), Object.values(scope).map(() => true));
});

test('unowned docs changes do not trigger heavy CI jobs', () => {
  const scope = classifyChangedFiles(['docs/notes.md'], workspace);

  assert.deepEqual(Object.values(scope), Object.values(scope).map(() => false));
});

test('per-cap chat python change triggers cockpit_e2e + cockpit_examples + cockpit_smoke', () => {
  const scope = classifyChangedFiles(
    ['cockpit/new/cap/python/langgraph.json'],
    workspace,
  );
  assert.equal(scope.cockpit_examples, true);
  assert.equal(scope.cockpit_e2e, true);
  assert.equal(scope.cockpit_smoke, true); // existing path — preserved
});

test('per-cap python change without smoke target still triggers e2e + examples', () => {
  // Project setup: an imagined render python with only `build` target.
  const renderProjects = [
    ...projects,
    {
      name: 'cockpit-render-fake-python',
      root: 'cockpit/render/fake/python',
      sourceRoot: 'cockpit/render/fake/python/src',
      projectType: 'library',
      tags: [],
      targets: { build: {} },
    },
  ];
  const scope = classifyChangedFiles(
    ['cockpit/render/fake/python/langgraph.json'],
    { projects: renderProjects, publishableProjects: ['chat'] },
  );
  assert.equal(scope.cockpit_examples, true);
  assert.equal(scope.cockpit_e2e, true);
  // No smoke target → cockpit_smoke stays false
  assert.equal(scope.cockpit_smoke, false);
});

test('generate-shared-deployment-config.ts triggers full cockpit scope', () => {
  const scope = classifyChangedFiles(
    ['scripts/generate-shared-deployment-config.ts'],
    workspace,
  );
  assert.equal(scope.cockpit, true);
  assert.equal(scope.cockpit_examples, true);
  assert.equal(scope.cockpit_smoke, true);
  assert.equal(scope.cockpit_e2e, true);
  assert.equal(scope.cockpit_deploy_smoke, true);
});
