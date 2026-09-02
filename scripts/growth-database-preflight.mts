import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

type GrowthDatabaseMode = 'integration' | 'migration';
type Environment = Record<string, string | undefined>;

interface ValidateGrowthDatabaseEnvironmentOptions {
  mode: GrowthDatabaseMode;
  environment: Environment;
  nodeVersion: string;
}

interface RunnerResult {
  error?: Error;
  signal?: NodeJS.Signals | null;
  status: number | null;
}

interface RunnerOptions {
  cwd: string;
  env: Environment;
  stdio: 'inherit';
}

type CommandRunner = (
  command: string,
  arguments_: string[],
  options: RunnerOptions
) => RunnerResult;

interface RunGrowthIntegrationTestsOptions {
  environment: Environment;
  nodeVersion: string;
  runner?: CommandRunner;
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(scriptDirectory, '..');

function hasOwn(environment: Environment, name: string): boolean {
  return Object.prototype.hasOwnProperty.call(environment, name);
}

function requireNonblank(environment: Environment, name: string): void {
  if (!environment[name]?.trim()) {
    throw new Error(`${name} is required and must be nonempty`);
  }
}

function requireAbsent(environment: Environment, name: string): void {
  if (hasOwn(environment, name)) {
    throw new Error(`${name} must be absent`);
  }
}

export function validateGrowthDatabaseEnvironment({
  mode,
  environment,
  nodeVersion,
}: ValidateGrowthDatabaseEnvironmentOptions): void {
  const nodeMajor = Number.parseInt(nodeVersion.split('.')[0] ?? '', 10);
  if (nodeMajor !== 22) {
    throw new Error('Node 22 is required for growth database operations');
  }

  if (mode === 'integration') {
    requireNonblank(environment, 'TEST_DATABASE_URL');
    requireAbsent(environment, 'DATABASE_URL');
    requireAbsent(environment, 'DAWN_DATABASE_URL');
    return;
  }

  requireNonblank(environment, 'DATABASE_URL');
  requireAbsent(environment, 'TEST_DATABASE_URL');
  requireAbsent(environment, 'DAWN_DATABASE_URL');
}

export function runGrowthIntegrationTests({
  environment,
  nodeVersion,
  runner = (command, arguments_, options) =>
    spawnSync(command, arguments_, options),
}: RunGrowthIntegrationTestsOptions): number {
  validateGrowthDatabaseEnvironment({
    mode: 'integration',
    environment,
    nodeVersion,
  });

  const result = runner(
    process.execPath,
    [
      resolve(workspaceRoot, 'node_modules/vitest/vitest.mjs'),
      'run',
      '--config',
      'libs/growth/vite.integration.config.mts',
      '--reporter=verbose',
    ],
    {
      cwd: workspaceRoot,
      env: { ...environment, GROWTH_INTEGRATION: '1' },
      stdio: 'inherit',
    }
  );

  if (result.error || result.status === null) {
    throw new Error(
      result.signal
        ? 'Growth integration runner terminated by a signal'
        : 'Growth integration runner failed to start'
    );
  }

  return result.status;
}

function main(): void {
  if (process.argv[2] !== 'integration') {
    throw new Error('Expected the integration preflight mode');
  }

  process.exitCode = runGrowthIntegrationTests({
    environment: process.env,
    nodeVersion: process.versions.node,
  });
}

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
  try {
    main();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown failure';
    process.stderr.write(`Growth database preflight failed: ${message}.\n`);
    process.exitCode = 1;
  }
}
