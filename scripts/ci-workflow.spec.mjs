import { readdir, readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('CI workflow', () => {
  async function readWorkflow() {
    return readFile('.github/workflows/ci.yml', 'utf8');
  }

  async function readDeployJob() {
    const workflow = await readWorkflow();
    return workflow.slice(
      workflow.indexOf('  deploy:'),
      workflow.indexOf('  demo-deploy:')
    );
  }

  async function readProductionSmokeJob() {
    const workflow = await readWorkflow();
    return workflow.slice(
      workflow.indexOf('  production-smoke:'),
      workflow.indexOf('  posthog-sync-plan:')
    );
  }

  async function readPostHogSyncPlanJob() {
    const workflow = await readWorkflow();
    return workflow.slice(workflow.indexOf('  posthog-sync-plan:'));
  }

  async function readCockpitE2eSummaryJob() {
    const workflow = await readWorkflow();
    return workflow.slice(
      workflow.indexOf('  cockpit-e2e-summary:'),
      workflow.indexOf('  website-e2e:')
    );
  }

  async function readRequiredPrChecksJob() {
    const workflow = await readWorkflow();
    return workflow.slice(
      workflow.indexOf('  required-pr-checks:'),
      workflow.indexOf('  deploy:')
    );
  }

  async function readPostHogQualityWorkflow() {
    return readFile('.github/workflows/posthog-quality.yml', 'utf8');
  }

  async function readWorkflowFiles() {
    const names = await readdir('.github/workflows');
    return Promise.all(
      names
        .filter((name) => name.endsWith('.yml'))
        .map(async (name) => ({
          name,
          text: await readFile(`.github/workflows/${name}`, 'utf8'),
        }))
    );
  }

  it('treats nested library files as deploy-relevant changes', async () => {
    const deployJob = await readDeployJob();

    const pattern = deployJob.match(/grep -E '([^']+)' >\/dev\/null/);

    assert.match(
      'libs/chat/src/lib/styles/chat-sidenav.styles.ts',
      new RegExp(pattern?.[1] ?? '')
    );
  });

  it('installs dependencies before assembling changed Angular examples', async () => {
    const deployJob = await readDeployJob();

    const dependencyInstall = deployJob.match(
      /-\s+if:\s*(.+)\n\s+run:\s+npm ci/
    );

    assert.match(
      dependencyInstall?.[1] ?? '',
      /steps\.examples_changed\.outputs\.changed == 'true'/
    );
  });

  it('runs production smoke after the canonical demo deploy', async () => {
    const productionSmokeJob = await readProductionSmokeJob();

    assert.match(productionSmokeJob, /needs:\s*\[deploy,\s*demo-deploy\]/);
  });

  it('verifies the shared backend before installing Playwright browsers', async () => {
    const productionSmokeJob = await readProductionSmokeJob();

    assert.ok(
      productionSmokeJob.indexOf('Verify shared LangGraph backend') <
        productionSmokeJob.indexOf(
          'npx playwright install --with-deps chromium'
        )
    );
  });

  it('runs production smoke against Threadplane domains', async () => {
    const productionSmokeJob = await readProductionSmokeJob();

    assert.match(productionSmokeJob, /BASE_URL:\s*https:\/\/cockpit\.threadplane\.ai/);
    assert.match(productionSmokeJob, /EXAMPLES_URL:\s*https:\/\/examples\.threadplane\.ai/);
    assert.match(productionSmokeJob, /DEMO_URL:\s*https:\/\/demo\.threadplane\.ai/);
  });

  it('binds Vercel deploys to the renamed Threadplane projects', async () => {
    const deployJob = await readDeployJob();
    const workflow = await readWorkflow();

    assert.match(deployJob, /"projectName":"threadplane"/);
    assert.match(deployJob, /"projectName":"threadplane-cockpit"/);
    assert.match(deployJob, /"projectName":"threadplane-examples"/);
    assert.match(workflow, /"projectName":"threadplane-demo"/);
  });

  it('uses the read-only PostHog key for CI drift checks', async () => {
    const postHogSyncPlanJob = await readPostHogSyncPlanJob();

    assert.match(
      postHogSyncPlanJob,
      /POSTHOG_PERSONAL_API_KEY:\s*\$\{\{\s*secrets\.POSTHOG_PERSONAL_API_KEY_READONLY\s*\}\}/
    );
  });

  it('uses the read-only PostHog key for scheduled live quality checks', async () => {
    const postHogQualityWorkflow = await readPostHogQualityWorkflow();

    assert.match(
      postHogQualityWorkflow,
      /POSTHOG_PERSONAL_API_KEY:\s*\$\{\{\s*secrets\.POSTHOG_PERSONAL_API_KEY_READONLY\s*\}\}/
    );
  });

  it('explicitly disables install telemetry in workflows that install npm dependencies', async () => {
    const workflowsWithNpmInstall = (await readWorkflowFiles()).filter(
      ({ text }) => /\brun:\s*npm (?:ci|install)\b/.test(text)
    );

    assert.notEqual(workflowsWithNpmInstall.length, 0);

    for (const { name, text } of workflowsWithNpmInstall) {
      assert.match(
        text,
        /\nenv:\n(?:  [A-Z0-9_]+: .+\n)*  DO_NOT_TRACK: ['"]1['"]/,
        `${name} should set top-level DO_NOT_TRACK=1`
      );
    }
  });

  it('lets the cockpit e2e summary inspect CI scope outputs', async () => {
    const cockpitE2eSummaryJob = await readCockpitE2eSummaryJob();

    assert.match(cockpitE2eSummaryJob, /needs:\s*\[ci-scope,\s*cockpit-e2e\]/);
    assert.match(cockpitE2eSummaryJob, /needs\.ci-scope\.outputs\.cockpit_e2e/);
  });

  it('provides one stable required PR check that waits for scoped CI jobs', async () => {
    const requiredPrChecksJob = await readRequiredPrChecksJob();

    assert.match(requiredPrChecksJob, /name:\s*CI — required/);
    assert.match(
      requiredPrChecksJob,
      /if:\s*\$\{\{\s*always\(\)\s*&&\s*github\.event_name == 'pull_request'\s*\}\}/
    );

    for (const job of [
      'ci-scope',
      'library',
      'website',
      'cockpit',
      'cockpit-examples-build',
      'cockpit-smoke',
      'cockpit-secret-integration',
      'cockpit-deploy-smoke',
      'examples-chat-smoke',
      'examples-chat-e2e',
      'cockpit-e2e-summary',
      'website-e2e',
      'posthog-sync-plan',
    ]) {
      assert.match(requiredPrChecksJob, new RegExp(`\\b${job}\\b`));
    }

    assert.match(
      requiredPrChecksJob,
      /RESULT_EXAMPLES_CHAT_E2E:\s*\$\{\{\s*needs\.examples-chat-e2e\.result\s*\}\}/
    );
    assert.match(
      requiredPrChecksJob,
      /SCOPE_EXAMPLES_CHAT:\s*\$\{\{\s*needs\.ci-scope\.outputs\.examples_chat\s*\}\}/
    );
    assert.match(
      requiredPrChecksJob,
      /require_scoped "examples_chat" "examples\/chat — e2e"/
    );
    assert.match(
      requiredPrChecksJob,
      /require_scoped "website_e2e" "Website — e2e"/
    );
    assert.match(
      requiredPrChecksJob,
      /require_scoped "cockpit_e2e" "Cockpit — e2e"/
    );
  });
});
