#!/usr/bin/env node
import { createServer } from 'node:http';
import { writeFileSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const POSTINSTALL_EVENT = 'ngaf:postinstall';

export function expectedPostinstallPackages(packageRoots) {
  return packageRoots
    .filter(({ manifest }) =>
      typeof manifest?.name === 'string'
      && manifest.name.startsWith('@ngaf/')
      && typeof manifest.scripts?.postinstall === 'string'
    )
    .map(({ manifest }) => manifest.name);
}

export function assertObservedPostinstallEvents({ expectedPackages, events }) {
  const observed = new Set(
    events
      .filter((event) => event?.event === POSTINSTALL_EVENT)
      .map((event) => event?.properties?.pkg)
      .filter((pkg) => typeof pkg === 'string'),
  );
  const missing = expectedPackages.filter((pkg) => !observed.has(pkg));
  if (missing.length > 0) {
    throw new Error(`Missing ngaf:postinstall events for ${missing.join(', ')}`);
  }
}

async function loadPackageRoots(roots) {
  return Promise.all(roots.map(async (root) => {
    const absoluteRoot = resolve(root);
    const manifest = JSON.parse(await readFile(join(absoluteRoot, 'package.json'), 'utf8'));
    return { root: absoluteRoot, manifest };
  }));
}

function npmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function packPackage(root, tarballDir) {
  const output = execFileSync(npmCommand(), [
    'pack',
    root,
    '--json',
    '--pack-destination',
    tarballDir,
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const [packed] = JSON.parse(output);
  if (!packed?.filename) {
    throw new Error(`npm pack did not return a filename for ${root}`);
  }
  return join(tarballDir, basename(packed.filename));
}

async function startIngestServer(events) {
  const server = createServer((req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(405);
      res.end();
      return;
    }
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        events.push(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        res.writeHead(204);
      } catch {
        res.writeHead(400);
      }
      res.end();
    });
  });
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to allocate local ingest server port');
  }
  return {
    url: `http://127.0.0.1:${address.port}/ingest`,
    close: () => new Promise((resolveClose, reject) => {
      server.close((err) => err ? reject(err) : resolveClose());
    }),
  };
}

async function installTarballs({ tarballs, tempProject, ingestUrl }) {
  writeFileSync(join(tempProject, 'package.json'), JSON.stringify({
    private: true,
    name: 'ngaf-install-telemetry-smoke',
    version: '0.0.0',
  }, null, 2) + '\n');

  const env = {
    ...process.env,
    NGAF_TELEMETRY_INGEST_URL: ingestUrl,
    NGAF_TELEMETRY_SAMPLE_RATE: '1',
    DEBUG: process.env.DEBUG ?? '',
    CI: 'false',
    GITHUB_ACTIONS: 'false',
    CONTINUOUS_INTEGRATION: 'false',
    BUILDKITE: 'false',
    CIRCLECI: 'false',
    DO_NOT_TRACK: '0',
    NGAF_TELEMETRY_DISABLED: '0',
  };
  delete env.npm_config_do_not_track;
  delete env.NPM_CONFIG_DO_NOT_TRACK;

  await new Promise((resolveInstall, reject) => {
    const child = spawn(npmCommand(), [
      'install',
      '--foreground-scripts',
      '--package-lock=false',
      '--no-audit',
      '--no-fund',
      '--legacy-peer-deps',
      ...tarballs,
    ], {
      cwd: tempProject,
      env,
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolveInstall();
      } else {
        reject(new Error(`npm install failed with ${signal ?? `exit code ${code}`}`));
      }
    });
  });
}

export async function smokeInstallTelemetry(packageRootArgs) {
  if (packageRootArgs.length === 0) {
    throw new Error('Usage: node libs/telemetry/scripts/smoke-install-telemetry.mjs <package-root> [...]');
  }

  const packageRoots = await loadPackageRoots(packageRootArgs);
  const expectedPackages = expectedPostinstallPackages(packageRoots);
  if (expectedPackages.length === 0) {
    throw new Error('No publishable @ngaf/* packages require postinstall telemetry in the provided roots');
  }

  const tempRoot = await mkdtemp(join(tmpdir(), 'ngaf-install-telemetry-'));
  const tarballDir = join(tempRoot, 'tarballs');
  const tempProject = join(tempRoot, 'project');
  await Promise.all([
    mkdir(tarballDir, { recursive: true }),
    mkdir(tempProject, { recursive: true }),
  ]);

  const events = [];
  const ingest = await startIngestServer(events);
  try {
    const tarballs = packageRoots.map(({ root }) => packPackage(root, tarballDir));
    await installTarballs({ tarballs, tempProject, ingestUrl: ingest.url });
    assertObservedPostinstallEvents({ expectedPackages, events });
    console.log(`[install-telemetry-smoke] observed ${POSTINSTALL_EVENT} for ${expectedPackages.join(', ')}`);
  } finally {
    await ingest.close();
    if (process.env.NGAF_TELEMETRY_KEEP_SMOKE_TMP !== '1') {
      await rm(tempRoot, { recursive: true, force: true });
    } else {
      console.log(`[install-telemetry-smoke] kept temp dir ${tempRoot}`);
    }
  }
}

async function main() {
  try {
    await smokeInstallTelemetry(process.argv.slice(2));
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}
