import { readFile } from 'node:fs/promises';
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
        productionSmokeJob.indexOf('npx playwright install --with-deps chromium')
    );
  });

});
