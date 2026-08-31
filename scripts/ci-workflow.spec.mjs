import { readdir, readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function withoutYamlCommentLines(text) {
  return text
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');
}

function readJobBlock(workflow, jobName) {
  const uncommented = withoutYamlCommentLines(workflow);
  const jobPattern = new RegExp(`^ {2}${escapeRegExp(jobName)}:\\s*$`, 'm');
  const jobMatch = jobPattern.exec(uncommented);

  assert.ok(jobMatch, `expected workflow job ${jobName}`);

  const jobStart = jobMatch.index;
  const afterHeader = jobStart + jobMatch[0].length;
  const remaining = uncommented.slice(afterHeader);
  const nextJob = /^ {2}[A-Za-z0-9_-]+:\s*$/m.exec(remaining);
  const jobEnd = nextJob ? afterHeader + nextJob.index : uncommented.length;

  return uncommented.slice(jobStart, jobEnd);
}

function readJobFieldBlock(job, fieldName) {
  const lines = withoutYamlCommentLines(job).split('\n');
  const fieldPattern = new RegExp(
    `^ {4}${escapeRegExp(fieldName)}:(?:\\s+.*)?$`
  );
  const fieldIndex = lines.findIndex((line) => fieldPattern.test(line));

  assert.notEqual(fieldIndex, -1, `expected job field ${fieldName}`);

  const fieldLines = [lines[fieldIndex]];
  for (const line of lines.slice(fieldIndex + 1)) {
    if (/^ {4}[A-Za-z0-9_-]+:/.test(line)) break;
    if (line.trim()) fieldLines.push(line);
  }
  return fieldLines.join('\n');
}

function readJobNeeds(job) {
  const needsBlock = readJobFieldBlock(job, 'needs');
  const [header, ...listLines] = needsBlock.split('\n');
  const inlineValue = header.replace(/^ {4}needs:\s*/, '').trim();

  if (inlineValue.startsWith('[') && inlineValue.endsWith(']')) {
    return inlineValue
      .slice(1, -1)
      .split(',')
      .map((value) => value.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);
  }
  if (inlineValue) {
    return [inlineValue.replace(/\s+#.*$/, '').replace(/^['"]|['"]$/g, '')];
  }
  return listLines
    .map((line) => /^ {6}-\s+([^\s#]+)/.exec(line)?.[1])
    .filter(Boolean);
}

describe('CI workflow', () => {
  async function readWorkflow() {
    return readFile('.github/workflows/ci.yml', 'utf8');
  }

  async function readDeployJob() {
    return readJobBlock(await readWorkflow(), 'deploy');
  }

  async function readLibraryJob() {
    return readJobBlock(await readWorkflow(), 'library');
  }

  async function readAngularCompatibilityJob() {
    return readJobBlock(await readWorkflow(), 'angular-compatibility');
  }

  async function readLibraryJob() {
    const workflow = await readWorkflow();
    return workflow.slice(
      workflow.indexOf('\n  library:\n'),
      workflow.indexOf('\n  website:\n')
    );
  }

  async function readCanonicalDemoJob() {
    return readJobBlock(await readWorkflow(), 'demo-deploy');
  }

  async function readProductionSmokeJob() {
    return readJobBlock(await readWorkflow(), 'production-smoke');
  }

  async function readPostHogSyncPlanJob() {
    return readJobBlock(await readWorkflow(), 'posthog-sync-plan');
  }

  async function readCockpitE2eSummaryJob() {
    return readJobBlock(await readWorkflow(), 'cockpit-e2e-summary');
  }

  async function readRequiredPrChecksJob() {
    return readJobBlock(await readWorkflow(), 'required-pr-checks');
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
          text: withoutYamlCommentLines(
            await readFile(`.github/workflows/${name}`, 'utf8')
          ),
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

  it('isolates langgraph coverage before the remaining bounded library tests', async () => {
    const libraryJob = await readLibraryJob();

    assert.match(
      libraryJob,
      /npx nx test langgraph --coverage --maxWorkers=2 --reporter=default/
    );
    assert.match(
      libraryJob,
      /npx nx run-many -t test --projects=chat,ag-ui,render,a2ui,telemetry --coverage --parallel=1 --maxWorkers=2/
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

    assert.match(
      productionSmokeJob,
      /BASE_URL:\s*https:\/\/cockpit\.threadplane\.ai/
    );
    assert.match(
      productionSmokeJob,
      /EXAMPLES_URL:\s*https:\/\/examples\.threadplane\.ai/
    );
    assert.match(
      productionSmokeJob,
      /DEMO_URL:\s*https:\/\/demo\.threadplane\.ai/
    );
  });

  it('guards every production promotion against a superseded commit', async () => {
    // Pushes to main do not cancel in-progress runs, so a slower older run can
    // reach a deploy job after a newer commit shipped. Without this guard it
    // rebuilds --prod from its older checkout and overwrites production.
    const workflow = await readWorkflow();

    for (const job of [await readDeployJob(), await readCanonicalDemoJob()]) {
      assert.match(job, /id:\s*freshness/);
      assert.match(job, /git ls-remote origin refs\/heads\/main/);
    }

    // Each `vercel deploy --prod` must sit behind the freshness gate.
    const promotions = workflow
      .split(/^ {6}- /m)
      .filter((step) => /vercel deploy[^\n]*--prod/.test(step));

    assert.ok(
      promotions.length >= 4,
      `expected the 4 known promotions, found ${promotions.length}`
    );
    for (const step of promotions) {
      const name = step.split('\n')[0];
      assert.match(
        step,
        /if:[^\n]*steps\.freshness\.outputs\.stale\s*!=\s*'true'/,
        `production promotion is not guarded by the freshness check: ${name}`
      );
    }
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
        /\nenv:\n(?: {2}[A-Z0-9_]+: .+\n)* {2}DO_NOT_TRACK: ['"]1['"]/,
        `${name} should set top-level DO_NOT_TRACK=1`
      );
    }
  });

  it('lets the cockpit e2e summary inspect CI scope outputs', async () => {
    const cockpitE2eSummaryJob = await readCockpitE2eSummaryJob();

    assert.match(cockpitE2eSummaryJob, /needs:\s*\[ci-scope,\s*cockpit-e2e\]/);
    assert.match(cockpitE2eSummaryJob, /needs\.ci-scope\.outputs\.cockpit_e2e/);
  });

  it('uploads one production library artifact for compatibility consumers', async () => {
    const libraryJob = await readLibraryJob();

    assert.match(
      libraryJob,
      /uses:\s*actions\/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02/
    );
    assert.match(libraryJob, /name:\s*threadplane-library-dist/);
    assert.match(libraryJob, /path:\s*dist\/libs/);
  });

  it('runs the packaged consumer matrix against the uploaded artifact', async () => {
    const job = await readAngularCompatibilityJob();

    assert.match(job, /needs:\s*\[ci-scope,\s*library\]/);
    assert.match(job, /angular:\s*\[20,\s*21,\s*22\]/);
    assert.match(job, /node-version:\s*22\.22\.3/);
    assert.match(
      job,
      /uses:\s*actions\/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093/
    );
    assert.match(job, /name:\s*threadplane-library-dist/);
    assert.match(job, /path:\s*dist\/libs/);
    assert.match(job, /npx playwright install --with-deps chromium/);
    assert.match(
      job,
      /node examples\/chat\/smoke\/cli\.mjs[\s\S]*--install --build --runtime/
    );
    assert.doesNotMatch(job, /nx (?:run-many[^\n]*-t build|build)/);
  });

  it('keeps runtime diagnostics for each failed Angular lane', async () => {
    const job = await readAngularCompatibilityJob();

    assert.match(job, /if:\s*failure\(\)/);
    assert.match(
      job,
      /name:\s*angular-\$\{\{ matrix\.angular \}\}-compatibility-diagnostics/
    );
    assert.match(
      job,
      /threadplane-angular-\$\{\{ matrix\.angular \}\}\/runtime-smoke\.png/
    );
    assert.match(
      job,
      /threadplane-angular-\$\{\{ matrix\.angular \}\}\/runtime-smoke-trace\.zip/
    );
    assert.match(
      job,
      /threadplane-angular-\$\{\{ matrix\.angular \}\}\/package\.json/
    );
    assert.match(
      job,
      /threadplane-angular-\$\{\{ matrix\.angular \}\}\/package-lock\.json/
    );
  });

  it('runs the library producer for Angular compatibility-only changes', async () => {
    const libraryJob = await readLibraryJob();

    assert.match(
      libraryJob,
      /needs\.ci-scope\.outputs\.angular_compatibility == 'true'/
    );
  });

  it('provides one stable required PR check that waits for scoped CI jobs', async () => {
    const requiredPrChecksJob = await readRequiredPrChecksJob();
    const expectedNeeds = [
      'ci-scope',
      'library',
      'angular-compatibility',
      'website',
      'cockpit',
      'cockpit-examples-build',
      'cockpit-smoke',
      'cockpit-deploy-smoke',
      'examples-chat-smoke',
      'examples-chat-e2e',
      'cockpit-e2e-summary',
      'website-e2e',
      'posthog-sync-plan',
    ];

    assert.match(requiredPrChecksJob, /name:\s*CI — required/);
    assert.match(
      requiredPrChecksJob,
      /if:\s*\$\{\{\s*always\(\)\s*&&\s*github\.event_name == 'pull_request'\s*\}\}/
    );

    assert.deepEqual(readJobNeeds(requiredPrChecksJob), expectedNeeds);

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
    assert.match(
      requiredPrChecksJob,
      /require_scoped\s+\\?\s*"angular_compatibility"\s+\\?\s*"Angular compatibility matrix"/
    );
  });
});

describe('CI workflow test helpers', () => {
  it('reads multiline and inline needs fields without comment-only entries', () => {
    const multilineJob = `  example:
    needs:
      - ci-scope
      # - comment-only-job
      - library
    runs-on: ubuntu-latest`;
    const inlineJob = `  example:
    needs: [ci-scope, library]
    runs-on: ubuntu-latest`;

    assert.deepEqual(readJobNeeds(readJobBlock(multilineJob, 'example')), [
      'ci-scope',
      'library',
    ]);
    assert.deepEqual(readJobNeeds(readJobBlock(inlineJob, 'example')), [
      'ci-scope',
      'library',
    ]);
  });

  it('does not treat needs result references as job dependencies', () => {
    const job = readJobBlock(
      `  required-pr-checks:
    needs: [ci-scope]
    env:
      RESULT_LIBRARY: \${{ needs.library.result }}`,
      'required-pr-checks'
    );

    assert.deepEqual(readJobNeeds(job), ['ci-scope']);
    assert.match(job, /needs\.library\.result/);
  });
});
