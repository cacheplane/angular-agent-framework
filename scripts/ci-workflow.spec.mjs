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

  async function readDemoDeployJob() {
    const workflow = await readWorkflow();
    return workflow.slice(
      workflow.indexOf('  demo-deploy:'),
      workflow.indexOf('  production-smoke:')
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

  it('runs examples chat protocol e2e before deploying the canonical demo', async () => {
    const workflow = await readWorkflow();
    const demoDeployJob = await readDemoDeployJob();

    assert.match(workflow, /examples-chat-protocol-e2e:/);
    assert.match(workflow, /npx nx e2e examples-chat-protocol-e2e --skip-nx-cache/);
    assert.match(
      demoDeployJob,
      /needs:\s*\[examples-chat-smoke,\s*examples-chat-e2e,\s*examples-chat-protocol-e2e\]/
    );
    assert.match(
      demoDeployJob,
      /examples\/chat — protocol e2e finished with \$\{\{ needs\.examples-chat-protocol-e2e\.result \}\}/
    );
  });
});
