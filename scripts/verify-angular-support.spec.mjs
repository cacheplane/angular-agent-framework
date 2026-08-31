import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

import {
  ANGULAR_MANIFESTS,
  ANGULAR_PEER_RANGE,
  verifyPeerRanges,
  verifyWebsiteMajors,
} from './verify-angular-support.mjs';

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function createFixture(t, updateManifest) {
  const root = await mkdtemp(join(tmpdir(), 'threadplane-angular-support-'));
  t.after(() => rm(root, { force: true, recursive: true }));

  for (const manifest of ANGULAR_MANIFESTS) {
    await writeJson(join(root, manifest), {
      peerDependencies: {
        '@angular/core': ANGULAR_PEER_RANGE,
      },
    });
  }

  await updateManifest(root);
  return root;
}

function runNode(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stderr, stdout }));
  });
}

function createWebsiteFixture({
  supportedMajors = [20, 21, 22],
  supportedVersions = 'Angular 20, 21, 22',
  plannedVersions = '—',
  pricingSupportSummary = 'Angular 20, 21, and 22 support',
} = {}) {
  return {
    websiteAngularSupportRows: [
      {
        label: 'Supported',
        versions: supportedVersions,
        tone: 'success',
      },
      { label: 'Experimental', versions: '—', tone: 'warn' },
      { label: 'Planned', versions: plannedVersions, tone: 'info' },
      { label: 'Unsupported', versions: 'Angular ≤19', tone: 'muted' },
    ],
    websiteSupportedAngularMajors: supportedMajors,
    websitePricingSupportSummary: pricingSupportSummary,
  };
}

test('imports without CLI side effects when argv[1] is undefined', async () => {
  const result = await runNode([
    '--input-type=module',
    '-e',
    "await import('./scripts/verify-angular-support.mjs')",
  ]);

  assert.deepEqual(result, { code: 0, stderr: '', stdout: '' });
});

test('uses the expected Angular peer range in every repository manifest', async () => {
  assert.equal(ANGULAR_PEER_RANGE, '^20.0.0 || ^21.0.0 || ^22.0.0');
  await verifyPeerRanges();
});

test('uses the registry Angular majors in website support data', async () => {
  await verifyWebsiteMajors();
});

test('reports website support data that omits Angular 22', async () => {
  await assert.rejects(
    verifyWebsiteMajors(createWebsiteFixture({ supportedMajors: [20, 21] })),
    /website supported Angular majors expected "20, 21, 22" but found "20, 21"/
  );
});

test('reports website support data that advertises Angular 23', async () => {
  await assert.rejects(
    verifyWebsiteMajors(
      createWebsiteFixture({ supportedMajors: [20, 21, 22, 23] })
    ),
    /website supported Angular majors expected "20, 21, 22" but found "20, 21, 22, 23"/
  );
});

test('reports a supported Angular major under the website Planned row', async () => {
  await assert.rejects(
    verifyWebsiteMajors(
      createWebsiteFixture({ plannedVersions: 'Angular 22' })
    ),
    /website Planned row must not contain supported Angular major 22/
  );
});

test('reports Supported row text that omits Angular 22', async () => {
  await assert.rejects(
    verifyWebsiteMajors(
      createWebsiteFixture({ supportedVersions: 'Angular 20, 21' })
    ),
    /website Supported row versions expected "Angular 20, 21, 22" but found "Angular 20, 21"/
  );
});

test('reports Supported row text that advertises Angular 23', async () => {
  await assert.rejects(
    verifyWebsiteMajors(
      createWebsiteFixture({ supportedVersions: 'Angular 20, 21, 22, 23' })
    ),
    /website Supported row versions expected "Angular 20, 21, 22" but found "Angular 20, 21, 22, 23"/
  );
});

test('reports a missing website Supported row', async () => {
  const fixture = createWebsiteFixture();
  fixture.websiteAngularSupportRows = fixture.websiteAngularSupportRows.filter(
    (row) => row.label !== 'Supported'
  );

  await assert.rejects(
    verifyWebsiteMajors(fixture),
    /website must contain exactly one Supported row but found 0/
  );
});

test('reports duplicate website Supported rows', async () => {
  const fixture = createWebsiteFixture();
  fixture.websiteAngularSupportRows = [
    ...fixture.websiteAngularSupportRows,
    { label: 'Supported', versions: 'Angular 20, 21, 22', tone: 'success' },
  ];

  await assert.rejects(
    verifyWebsiteMajors(fixture),
    /website must contain exactly one Supported row but found 2/
  );
});

test('reports a missing website Planned row', async () => {
  const fixture = createWebsiteFixture();
  fixture.websiteAngularSupportRows = fixture.websiteAngularSupportRows.filter(
    (row) => row.label !== 'Planned'
  );

  await assert.rejects(
    verifyWebsiteMajors(fixture),
    /website must contain exactly one Planned row but found 0/
  );
});

test('reports duplicate website Planned rows', async () => {
  const fixture = createWebsiteFixture();
  fixture.websiteAngularSupportRows = [
    ...fixture.websiteAngularSupportRows,
    { label: 'Planned', versions: '—', tone: 'info' },
  ];

  await assert.rejects(
    verifyWebsiteMajors(fixture),
    /website must contain exactly one Planned row but found 2/
  );
});

test('reports a pricing support summary that drifts from website majors', async () => {
  await assert.rejects(
    verifyWebsiteMajors(
      createWebsiteFixture({
        pricingSupportSummary: 'Angular 20 and 21 support',
      })
    ),
    /website pricing support summary expected "Angular 20, 21, and 22 support" but found "Angular 20 and 21 support"/
  );
});

test('reports a peer range that omits Angular 22', async (t) => {
  const root = await createFixture(t, async (fixtureRoot) => {
    await writeJson(join(fixtureRoot, 'libs/chat/package.json'), {
      peerDependencies: {
        '@angular/core': '^20.0.0 || ^21.0.0',
      },
    });
  });

  await assert.rejects(
    verifyPeerRanges({ root }),
    /libs\/chat\/package\.json peerDependencies\["@angular\/core"\] expected "\^20\.0\.0 \|\| \^21\.0\.0 \|\| \^22\.0\.0" but found "\^20\.0\.0 \|\| \^21\.0\.0"/
  );
});

test('reports a peer range that unexpectedly includes Angular 23', async (t) => {
  const root = await createFixture(t, async (fixtureRoot) => {
    await writeJson(join(fixtureRoot, 'libs/langgraph/package.json'), {
      peerDependencies: {
        '@angular/core': '^20.0.0 || ^21.0.0 || ^22.0.0 || ^23.0.0',
      },
    });
  });

  await assert.rejects(
    verifyPeerRanges({ root }),
    /libs\/langgraph\/package\.json peerDependencies\["@angular\/core"\] expected "\^20\.0\.0 \|\| \^21\.0\.0 \|\| \^22\.0\.0" but found "\^20\.0\.0 \|\| \^21\.0\.0 \|\| \^22\.0\.0 \|\| \^23\.0\.0"/
  );
});

test('checks optional Angular peers', async (t) => {
  const root = await createFixture(t, async (fixtureRoot) => {
    await writeJson(join(fixtureRoot, 'libs/telemetry/package.json'), {
      peerDependencies: {
        '@angular/core': '^20.0.0 || ^21.0.0',
      },
      peerDependenciesMeta: {
        '@angular/core': {
          optional: true,
        },
      },
    });
  });

  await assert.rejects(
    verifyPeerRanges({ root }),
    /libs\/telemetry\/package\.json peerDependencies\["@angular\/core"\]/
  );
});

test('aggregates every incorrect Angular peer field in a manifest', async (t) => {
  const root = await createFixture(t, async (fixtureRoot) => {
    await writeJson(join(fixtureRoot, 'libs/chat/package.json'), {
      peerDependencies: {
        '@angular/core': '^20.0.0 || ^21.0.0',
        '@angular/common': '^20.0.0 || ^21.0.0 || ^22.0.0 || ^23.0.0',
      },
    });
  });

  await assert.rejects(verifyPeerRanges({ root }), (error) => {
    assert.match(
      error.message,
      /libs\/chat\/package\.json peerDependencies\["@angular\/core"\]/
    );
    assert.match(
      error.message,
      /libs\/chat\/package\.json peerDependencies\["@angular\/common"\]/
    );
    return true;
  });
});

test('aggregates peer errors and unreadable manifests', async (t) => {
  const root = await createFixture(t, async (fixtureRoot) => {
    await writeJson(join(fixtureRoot, 'libs/chat/package.json'), {
      peerDependencies: {
        '@angular/core': '^20.0.0 || ^21.0.0',
      },
    });
    await writeJson(join(fixtureRoot, 'libs/langgraph/package.json'), {
      peerDependencies: {
        '@angular/core': '^20.0.0 || ^21.0.0 || ^22.0.0 || ^23.0.0',
      },
    });
    await rm(join(fixtureRoot, 'libs/render/package.json'));
  });

  await assert.rejects(verifyPeerRanges({ root }), (error) => {
    assert.match(
      error.message,
      /libs\/chat\/package\.json peerDependencies\["@angular\/core"\]/
    );
    assert.match(
      error.message,
      /libs\/langgraph\/package\.json peerDependencies\["@angular\/core"\]/
    );
    assert.match(
      error.message,
      /libs\/render\/package\.json could not be read:/
    );
    return true;
  });
});
