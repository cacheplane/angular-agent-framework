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

function readNamedStep(job, name) {
  const marker = `      - name: ${name}`;
  const start = job.indexOf(marker);
  assert.notEqual(start, -1, `expected workflow step ${name}`);
  const afterStart = job.slice(start + marker.length);
  const nextStep = /^ {6}- /m.exec(afterStart);
  const end = nextStep ? start + marker.length + nextStep.index : job.length;
  return job.slice(start, end);
}

describe('CI workflow', () => {
  it('scopes every vercel promote to the team that owns the deployment', async () => {
    const workflow = await readFile('.github/workflows/ci.yml', 'utf8');
    const promotes = workflow
      .split('\n')
      .filter((line) => line.includes('vercel promote'));

    assert.ok(promotes.length >= 2, 'expected Website and cockpit promotions');
    for (const line of promotes) {
      // `promote` takes a bare URL and cannot read .vercel/project.json, so
      // without --scope it uses the token's default team and fails.
      assert.match(line, /--scope=/, `unscoped vercel promote: ${line.trim()}`);
    }
  });


  it('runs in a merge queue and reports the required context there', async () => {
    const workflow = await readFile('.github/workflows/ci.yml', 'utf8');

    assert.match(
      workflow,
      /^  merge_group:\s*$/m,
      'ci.yml must trigger on merge_group or a merge queue blocks forever'
    );

    const required = readJobBlock(workflow, 'required-pr-checks');
    assert.match(
      required,
      /github\.event_name == 'merge_group'/,
      'CI — required is the only required context; it must report inside the queue'
    );
  });

  it('never lets a merge-queue candidate promote to production', async () => {
    const workflow = await readFile('.github/workflows/ci.yml', 'utf8');

    // A queue candidate builds on refs/heads/gh-readonly-queue/*, so every job
    // that touches production must be pinned to refs/heads/main. Without this
    // the queue would deploy unmerged candidates.
    for (const job of [
      'deploy',
      'demo-deploy',
      'ag-ui-demo-deploy',
      'production-smoke',
    ]) {
      const block = readJobBlock(workflow, job);
      assert.match(
        block,
        /github\.ref == 'refs\/heads\/main'/,
        `${job} must be pinned to refs/heads/main so a queue ref cannot deploy`
      );
    }
  });

  it('scopes a merge-queue candidate from the merge group range', async () => {
    const workflow = await readFile('.github/workflows/ci.yml', 'utf8');
    const scope = readJobBlock(workflow, 'ci-scope');

    assert.match(scope, /github\.event\.merge_group\.base_sha/);
    assert.match(scope, /github\.event\.merge_group\.head_sha/);
  });


  async function readWorkflow() {
    return readFile('.github/workflows/ci.yml', 'utf8');
  }

  async function readDeployJob() {
    return readJobBlock(await readWorkflow(), 'deploy');
  }

  async function readCiScopeJob() {
    return readJobBlock(await readWorkflow(), 'ci-scope');
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

  async function readAgUiDemoJob() {
    return readJobBlock(await readWorkflow(), 'ag-ui-demo-deploy');
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

  async function readGrowthLifecycleJob() {
    return readJobBlock(await readWorkflow(), 'growth-lifecycle');
  }

  async function readLifecycleJob() {
    return readJobBlock(await readWorkflow(), 'lifecycle');
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

  it('runs the Cockpit runtime bridge drift guard with the always-run scope tests', async () => {
    const ciScopeJob = await readCiScopeJob();

    assert.match(
      ciScopeJob,
      /name:\s*Test CI scope classifier\s+run:\s*node --test[^\n]*scripts\/cockpit-runtime-bridge-coverage\.spec\.mjs/
    );
  });

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

  it('treats the Cockpit runtime bridge as an Angular example deployment change', async () => {
    const deployJob = await readDeployJob();
    const examplesDetection = deployJob.slice(
      deployJob.indexOf('Check if examples changed'),
      deployJob.indexOf('- uses: actions/setup-node')
    );
    const patterns = [...examplesDetection.matchAll(/grep -E '([^']+)'/g)].map(
      (match) => new RegExp(match[1])
    );

    assert.ok(
      patterns.some((pattern) =>
        pattern.test('libs/cockpit-runtime-bridge/src/index.ts')
      )
    );
  });

  it('rebuilds examples for Website changes so the immutable preview origin reaches child policy', async () => {
    const deployJob = await readDeployJob();
    const examplesDetection = deployJob.slice(
      deployJob.indexOf('Check if examples changed'),
      deployJob.indexOf('- uses: actions/setup-node')
    );
    const patterns = [...examplesDetection.matchAll(/grep -E '([^']+)'/g)].map(
      (match) => new RegExp(match[1])
    );

    assert.ok(
      patterns.some((pattern) =>
        pattern.test('apps/website/src/components/workspace/WebsiteWorkspace.tsx')
      )
    );
    assert.ok(patterns.some((pattern) => pattern.test('vercel.json')));
  });

  it('smokes one immutable Website preview with its generated child policy before promoting it', async () => {
    const deployJob = await readDeployJob();
    const previewDeploy = deployJob.indexOf('Deploy immutable Website preview');
    const assembleExamples = deployJob.indexOf(
      'Build and assemble Angular examples'
    );
    const deployExamples = deployJob.indexOf(
      'Deploy Angular examples to Vercel (production)'
    );
    const previewSmoke = deployJob.indexOf(
      'Verify Website preview runtime embedding policy'
    );
    const promotionFreshness = deployJob.indexOf(
      'Check this commit is still the tip before Website promotion'
    );
    const promote = deployJob.indexOf(
      'Promote verified Website artifact unchanged'
    );

    for (const [label, position] of [
      ['Website preview deploy', previewDeploy],
      ['example assembly', assembleExamples],
      ['example deployment', deployExamples],
      ['Website preview smoke', previewSmoke],
      ['Website promotion freshness', promotionFreshness],
      ['Website promotion', promote],
    ]) {
      assert.notEqual(position, -1, `expected ${label} in the deploy job`);
    }
    assert.ok(
      previewDeploy < assembleExamples &&
        assembleExamples < deployExamples &&
        deployExamples < previewSmoke &&
        previewSmoke < promotionFreshness &&
        promotionFreshness < promote
    );

    const previewStep = readNamedStep(
      deployJob,
      'Deploy immutable Website preview'
    );
    const assemblyStep = readNamedStep(
      deployJob,
      'Build and assemble Angular examples'
    );
    const smokeStep = readNamedStep(
      deployJob,
      'Verify Website preview runtime embedding policy'
    );
    const freshnessStep = readNamedStep(
      deployJob,
      'Check this commit is still the tip before Website promotion'
    );
    const promoteStep = readNamedStep(
      deployJob,
      'Promote verified Website artifact unchanged'
    );

    assert.match(previewStep, /id:\s*deploy_website/);
    assert.match(
      previewStep,
      /vercel deploy[^\n]*--prebuilt[^\n]*--prod[^\n]*--skip-domain/
    );
    assert.match(previewStep, /new URL\(process\.argv\[1\]\)/);
    assert.match(previewStep, /process\.stdout\.write\(parsed\.origin\)/);
    assert.match(previewStep, /preview_origin=.*GITHUB_OUTPUT/);
    assert.match(
      assemblyStep,
      /RUNTIME_PARENT_PREVIEW_ORIGINS:\s*\$\{\{ steps\.deploy_website\.outputs\.preview_origin \}\}/
    );
    assert.match(
      smokeStep,
      /BASE_URL:\s*\$\{\{ steps\.deploy_website\.outputs\.preview_origin \}\}/
    );
    assert.match(
      smokeStep,
      /RUNTIME_PARENT_PREVIEW_ORIGINS:\s*\$\{\{ steps\.deploy_website\.outputs\.preview_origin \}\}/
    );
    assert.match(smokeStep, /unified runtime embedding policy/);
    assert.match(freshnessStep, /id:\s*website_promotion_freshness/);
    assert.match(freshnessStep, /git ls-remote origin refs\/heads\/main/);
    assert.match(freshnessStep, /fresh=false.*GITHUB_OUTPUT/);
    assert.match(freshnessStep, /fresh=true.*GITHUB_OUTPUT/);
    assert.match(
      promoteStep,
      /vercel promote "\$\{\{ steps\.deploy_website\.outputs\.deployment_url \}\}" --scope=\$\{\{ secrets\.VERCEL_ORG_ID \}\} --yes/
    );
    assert.match(
      promoteStep,
      /if:[^\n]*steps\.website_promotion_freshness\.outputs\.fresh\s*==\s*'true'/
    );
  });

  it('deploys examples before the Cockpit redirect artifact and preserves fail-fast ordering', async () => {
    const deployJob = await readDeployJob();
    const assembleExamples = deployJob.indexOf(
      'Build and assemble Angular examples'
    );
    const deployExamples = deployJob.indexOf(
      'Deploy Angular examples to Vercel (production)'
    );
    const prepareCockpit = deployJob.indexOf('Prepare cockpit Vercel project');
    const buildCockpit = deployJob.indexOf('Build cockpit redirect service');
    const deployCockpit = deployJob.indexOf(
      'Deploy immutable cockpit artifact'
    );

    for (const [label, position] of [
      ['example assembly', assembleExamples],
      ['example deployment', deployExamples],
      ['cockpit preparation', prepareCockpit],
      ['cockpit build', buildCockpit],
      ['cockpit deployment', deployCockpit],
    ]) {
      assert.notEqual(position, -1, `expected ${label} in the deploy job`);
    }
    assert.ok(assembleExamples < deployExamples);
    assert.ok(deployExamples < prepareCockpit);
    assert.ok(prepareCockpit < buildCockpit);
    assert.ok(buildCockpit < deployCockpit);

    const examplesBeforeCockpit = deployJob.slice(
      assembleExamples,
      prepareCockpit
    );
    assert.doesNotMatch(
      examplesBeforeCockpit,
      /continue-on-error:\s*true/,
      'example build/deploy must fail the linear job before Cockpit promotion'
    );

    for (const name of [
      'Build and assemble Angular examples',
      'Deploy Angular examples to Vercel (production)',
    ]) {
      const step = readNamedStep(deployJob, name);
      assert.doesNotMatch(step, /\|\||;\s*true(?:\s|$)|set\s+\+e/);
    }

    for (const name of [
      'Prepare cockpit Vercel project',
      'Build cockpit redirect service',
      'Deploy immutable cockpit artifact',
      'Exhaustively verify immutable cockpit preview',
      'Promote verified cockpit artifact unchanged',
      'Verify production cockpit redirects',
    ]) {
      const step = readNamedStep(deployJob, name);
      assert.doesNotMatch(step, /continue-on-error:\s*true/);
      assert.doesNotMatch(step, /if:[^\n]*(?:always|failure|cancelled)\s*\(/);
    }
  });

  it('smokes one immutable Cockpit deployment before promoting that exact URL', async () => {
    const deployJob = await readDeployJob();
    const websiteDeploy = deployJob.indexOf(
      'Deploy immutable Website preview'
    );
    const websiteSmoke = deployJob.indexOf('Verify deployed website');
    const cockpitBuild = deployJob.indexOf('Build cockpit redirect service');
    const cockpitDeploy = deployJob.indexOf(
      'Deploy immutable cockpit artifact'
    );
    const previewSmoke = deployJob.indexOf(
      'Exhaustively verify immutable cockpit preview'
    );
    const promotionFreshness = deployJob.indexOf(
      'Check this commit is still the tip before cockpit promotion'
    );
    const promote = deployJob.indexOf(
      'Promote verified cockpit artifact unchanged'
    );
    const productionSmoke = deployJob.indexOf(
      'Verify production cockpit redirects'
    );
    const platformJob = await readProductionSmokeJob();
    const platformSmoke = platformJob.indexOf('Run production smoke tests');
    const marker = platformJob.indexOf('Record this commit as promoted');

    assert.ok(
      websiteDeploy < websiteSmoke &&
        websiteSmoke < cockpitBuild &&
        cockpitBuild < cockpitDeploy &&
        cockpitDeploy < previewSmoke &&
        previewSmoke < promotionFreshness &&
        promotionFreshness < promote &&
        promote < productionSmoke
    );
    assert.ok(platformSmoke < marker);

    const deployStep = readNamedStep(
      deployJob,
      'Deploy immutable cockpit artifact'
    );
    const previewStep = readNamedStep(
      deployJob,
      'Exhaustively verify immutable cockpit preview'
    );
    const promotionFreshnessStep = readNamedStep(
      deployJob,
      'Check this commit is still the tip before cockpit promotion'
    );
    const promoteStep = readNamedStep(
      deployJob,
      'Promote verified cockpit artifact unchanged'
    );
    const productionStep = readNamedStep(
      deployJob,
      'Verify production cockpit redirects'
    );

    assert.match(deployStep, /id:\s*deploy_cockpit/);
    assert.match(deployStep, /vercel deploy[^\n]*--prod[^\n]*--skip-domain/);
    assert.match(
      deployStep,
      /--env COCKPIT_WEBSITE_ORIGIN=https:\/\/threadplane\.ai/
    );
    assert.match(
      previewStep,
      /--url "\$\{\{ steps\.deploy_cockpit\.outputs\.deployment_url \}\}"[\s\S]*--mode preview/
    );
    assert.match(promotionFreshnessStep, /id:\s*cockpit_promotion_freshness/);
    assert.match(
      promotionFreshnessStep,
      /git ls-remote origin refs\/heads\/main/
    );
    assert.match(promotionFreshnessStep, /if \[ -z "\$tip" \]/);
    assert.match(promotionFreshnessStep, /exit 1/);
    assert.match(
      promotionFreshnessStep,
      /if \[ "\$tip" != "\$\{\{ github\.sha \}\}" \]/
    );
    assert.match(promotionFreshnessStep, /fresh=false.*GITHUB_OUTPUT/);
    assert.match(promotionFreshnessStep, /fresh=true.*GITHUB_OUTPUT/);
    assert.match(
      promoteStep,
      /vercel promote "\$\{\{ steps\.deploy_cockpit\.outputs\.deployment_url \}\}" --scope=\$\{\{ secrets\.VERCEL_ORG_ID \}\} --yes/
    );
    assert.match(
      promoteStep,
      /if:[^\n]*steps\.cockpit_promotion_freshness\.outputs\.fresh\s*==\s*'true'/
    );
    assert.match(productionStep, /--mode production/);
    assert.match(
      productionStep,
      /if:[^\n]*steps\.cockpit_promotion_freshness\.outputs\.fresh\s*==\s*'true'/
    );
    assert.doesNotMatch(
      deployJob.slice(cockpitDeploy, promote),
      /vercel promote/
    );
    assert.equal(
      (deployStep.match(/vercel deploy/g) ?? []).length,
      1,
      'Cockpit deployment must be captured once'
    );
  });

  it('gates Cockpit deployment on the production Website smoke even for Cockpit-only changes', async () => {
    const deployJob = await readDeployJob();
    const websiteOrCockpit =
      /if:[^\n]*steps\.affected\.outputs\.website\s*==\s*'true'[^\n]*\|\|[^\n]*steps\.affected\.outputs\.cockpit\s*==\s*'true'/;

    for (const name of ['Cache Playwright browsers', 'Install Playwright browsers']) {
      const step = readNamedStep(deployJob, name);
      assert.match(
        step,
        websiteOrCockpit,
        `${name} must cover Cockpit-only runs`
      );
      assert.doesNotMatch(step, /continue-on-error:\s*true/);
    }

    const websiteSmokeStep = readNamedStep(deployJob, 'Verify deployed website');
    assert.match(websiteSmokeStep, websiteOrCockpit);
    assert.match(
      websiteSmokeStep,
      /steps\.website_promotion_freshness\.outputs\.fresh\s*==\s*'true'/
    );
    assert.doesNotMatch(websiteSmokeStep, /continue-on-error:\s*true/);

    for (const name of [
      'Prepare website Vercel project',
      'Deploy immutable Website preview',
    ]) {
      const step = readNamedStep(deployJob, name);
      assert.match(
        step,
        /if:[^\n]*steps\.affected\.outputs\.website\s*==\s*'true'/
      );
      assert.doesNotMatch(
        step,
        /steps\.affected\.outputs\.cockpit\s*==\s*'true'/
      );
    }

    const websiteSmoke = deployJob.indexOf('Verify deployed website');
    for (const cockpitStep of [
      'Prepare cockpit Vercel project',
      'Build cockpit redirect service',
      'Deploy immutable cockpit artifact',
    ]) {
      assert.ok(
        websiteSmoke < deployJob.indexOf(cockpitStep),
        `Website production smoke must precede ${cockpitStep}`
      );
    }
  });

  it('runs production smoke after every platform deployment job', async () => {
    const productionSmokeJob = await readProductionSmokeJob();
    const agUiDemoJob = await readAgUiDemoJob();

    assert.deepEqual(readJobNeeds(productionSmokeJob), [
      'deploy',
      'demo-deploy',
      'ag-ui-demo-deploy',
    ]);
    assert.match(
      readJobFieldBlock(agUiDemoJob, 'if'),
      /always\(\).*?!cancelled\(\).*?refs\/heads\/main.*?push/
    );
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
      /COCKPIT_URL:\s*https:\/\/cockpit\.threadplane\.ai/
    );
    assert.match(
      productionSmokeJob,
      /EXAMPLES_URL:\s*https:\/\/examples\.threadplane\.ai/
    );
    assert.match(
      productionSmokeJob,
      /RUNTIME_PARENT_PREVIEW_ORIGINS:\s*\$\{\{ needs\.deploy\.outputs\.runtime_parent_preview_origin \}\}/
    );
    assert.match(
      productionSmokeJob,
      /DEMO_URL:\s*https:\/\/demo\.threadplane\.ai/
    );
    assert.match(productionSmokeJob, /PRODUCTION_SMOKE:\s*'true'/);
    assert.match(productionSmokeJob, /BASE_URL:\s*https:\/\/threadplane\.ai/);
    assert.match(
      productionSmokeJob,
      /playwright test apps\/website\/e2e\/platform-production-smoke\.spec\.ts[^\n]*--config apps\/website\/playwright\.config\.ts/
    );
    assert.doesNotMatch(
      productionSmokeJob,
      /apps\/cockpit\/e2e\/production-smoke\.spec\.ts/
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

  it('runs the cockpit sibling libraries that own vitest specs', async () => {
    // `nx test cockpit` does not walk `^test`, and the `library` job runs a
    // hardcoded LIBS list that excludes both of these. If they are dropped
    // from this run-many their specs stop executing silently.
    const cockpitJob = readJobBlock(await readWorkflow(), 'cockpit');
    const runMany = cockpitJob.match(
      /npx nx run-many -t test --projects=(\S+)/
    );

    assert.ok(runMany, 'cockpit job should run tests via nx run-many');

    const projects = runMany[1].split(',');
    for (const project of ['cockpit', 'cockpit-docs', 'cockpit-registry']) {
      assert.ok(
        projects.includes(project),
        `cockpit job should run \`nx test ${project}\``
      );
    }
  });

  it('leaves interactive control-plane e2e ownership with the Website', async () => {
    // The Website now owns the interactive shell and its runtime server.
    // Cockpit is tested as an application here but must not reinstall a
    // browser or invoke the retired duplicate Playwright target.
    const workflow = await readWorkflow();
    const cockpitJob = readJobBlock(workflow, 'cockpit');
    const websiteE2eJob = readJobBlock(workflow, 'website-e2e');

    assert.match(
      websiteE2eJob,
      /npx playwright install(?:\s+--with-deps)?\s+chromium\b/,
      'Website e2e should install Chromium'
    );
    assert.match(
      websiteE2eJob,
      /npx nx e2e website\b/,
      'Website e2e should run the interactive shell suite'
    );

    assert.doesNotMatch(
      cockpitJob,
      /npx nx e2e cockpit\b/,
      'cockpit job should not run retired shell control-plane e2e'
    );
    assert.doesNotMatch(
      cockpitJob,
      /npx playwright install/,
      'cockpit job should not install a browser for retired shell e2e'
    );
  });

  it('scope-gates the examples/ag-ui e2e job and requires it', async () => {
    // This job had no `if:` at all — it ran on every push and pull_request,
    // including docs-only ones, at a 35-minute timeout. It was also left out
    // of required-pr-checks, so an ag-ui e2e failure did not block a merge.
    // Both halves are fixed together: gating it without requiring it would
    // leave a suite that is skipped often and ignored when it fails.
    const workflow = await readWorkflow();
    const job = readJobBlock(workflow, 'examples-ag-ui-e2e');

    assert.match(job, /needs\.ci-scope\.outputs\.examples_ag_ui == 'true'/);

    const required = readJobBlock(workflow, 'required-pr-checks');
    assert.match(
      required,
      /require_scoped \\\n\s*"examples_ag_ui"/,
      'required-pr-checks should aggregate the ag-ui e2e result'
    );
    assert.ok(
      readJobNeeds(required).includes('examples-ag-ui-e2e'),
      'required-pr-checks should depend on examples-ag-ui-e2e'
    );
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

  it('runs the root scripts vitest suites when the scripts project is affected', async () => {
    const workflow = await readWorkflow();
    const scriptsTestsJob = readJobBlock(workflow, 'scripts-tests');

    assert.match(
      scriptsTestsJob,
      /if: github\.event_name == 'push' \|\| needs\.ci-scope\.outputs\.scripts_tests == 'true'/
    );
    assert.match(scriptsTestsJob, /npx nx test scripts/);

    const requiredPrChecksJob = await readRequiredPrChecksJob();
    assert.match(
      requiredPrChecksJob,
      /RESULT_SCRIPTS_TESTS:\s*\$\{\{\s*needs\.scripts-tests\.result\s*\}\}/
    );
    assert.match(
      requiredPrChecksJob,
      /SCOPE_SCRIPTS_TESTS:\s*\$\{\{\s*needs\.ci-scope\.outputs\.scripts_tests\s*\}\}/
    );
    assert.match(
      requiredPrChecksJob,
      /require_scoped "scripts_tests" "Scripts — generator \/ proxy vitest suites"/
    );
  });

  it('exports the growth lifecycle scope and runs its Node 22 lane', async () => {
    const workflow = await readWorkflow();
    const scopeJob = readJobBlock(workflow, 'ci-scope');
    const job = await readGrowthLifecycleJob();

    assert.match(
      scopeJob,
      /growth_lifecycle:\s*\$\{\{ steps\.scope\.outputs\.growth_lifecycle \}\}/
    );
    assert.match(job, /needs\.ci-scope\.outputs\.growth_lifecycle == 'true'/);
    assert.match(job, /node-version:\s*22(?:\s|$)/m);
    assert.match(job, /npx nx lint growth(?:\s|$)/m);
    assert.match(job, /npx nx test growth(?:\s|$)/m);
    assert.match(job, /npx nx run growth:test-operator-cli(?:\s|$)/m);
    assert.match(job, /npx nx build growth(?:\s|$)/m);
    assert.match(job, /npx nx test google-mailbox-poller(?:\s|$)/m);
    assert.match(job, /npx nx lint google-mailbox-poller(?:\s|$)/m);
    assert.doesNotMatch(job, /test-integration/);
  });

  it('runs lifecycle lint, test, check, and build under Node 24', async () => {
    const job = await readLifecycleJob();

    assert.match(job, /needs\.ci-scope\.outputs\.growth_lifecycle == 'true'/);
    assert.match(job, /node-version:\s*24(?:\s|$)/m);
    assert.match(job, /npx nx lint lifecycle(?:\s|$)/m);
    assert.match(job, /npx nx test lifecycle(?:\s|$)/m);
    assert.match(job, /npx nx run lifecycle:check(?:\s|$)/m);
    assert.match(job, /npx nx build lifecycle(?:\s|$)/m);
    assert.doesNotMatch(
      job,
      /vercel deploy|growth:import-resend|apply-migrations/
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
      'examples-ag-ui-e2e',
      'cockpit-e2e-summary',
      'website-e2e',
      'posthog-sync-plan',
      'scripts-tests',
      'growth-lifecycle',
      'lifecycle',
    ];

    assert.match(requiredPrChecksJob, /name:\s*CI — required/);
    assert.match(
      requiredPrChecksJob,
      /if:\s*\$\{\{\s*always\(\)\s*&&\s*\(github\.event_name == 'pull_request'\s*\|\|\s*github\.event_name == 'merge_group'\)\s*\}\}/
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
    assert.match(
      requiredPrChecksJob,
      /RESULT_GROWTH_LIFECYCLE:\s*\$\{\{\s*needs\.growth-lifecycle\.result\s*\}\}/
    );
    assert.match(
      requiredPrChecksJob,
      /RESULT_LIFECYCLE:\s*\$\{\{\s*needs\.lifecycle\.result\s*\}\}/
    );
    assert.match(
      requiredPrChecksJob,
      /SCOPE_GROWTH_LIFECYCLE:\s*\$\{\{\s*needs\.ci-scope\.outputs\.growth_lifecycle\s*\}\}/
    );
    assert.match(
      requiredPrChecksJob,
      /require_scoped "growth_lifecycle" "Growth lifecycle — Node 22"/
    );
    assert.match(
      requiredPrChecksJob,
      /require_scoped "growth_lifecycle" "Lifecycle — Node 24"/
    );
  });

  it('gates the website deploy on both growth lifecycle lanes', async () => {
    const deployJob = await readDeployJob();
    const needs = readJobNeeds(deployJob);

    assert.ok(needs.includes('growth-lifecycle'));
    assert.ok(needs.includes('lifecycle'));
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
