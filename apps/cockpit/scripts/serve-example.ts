import { spawn, type ChildProcess } from 'child_process';
import { fileURLToPath } from 'node:url';
import { capabilities, findCapability, type Capability } from './capability-registry';

/** Empty base URL makes resolveRuntimeUrl fall through to http://localhost:<devPort>. */
export const COCKPIT_RUNTIME_ENV = { NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL: '' } as const;

/** Local backend launch command for a capability, derived from the registry. */
export function backendCommand(cap: Capability): string | null {
  if (!cap.pythonDir) return null;
  const enter = `cd ${cap.pythonDir} && source $HOME/.local/bin/env 2>/dev/null; uv sync`;
  if (cap.product === 'ag-ui') {
    return `${enter} && uv run uvicorn src.server:app --port ${cap.pythonPort}`;
  }
  return `${enter} && uv run langgraph dev --port ${cap.pythonPort} --no-browser`;
}

// Guard: only execute CLI/orchestration logic when run directly (not imported by tests).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const capabilityArg = args.find((a) => a.startsWith('--capability='))?.split('=')[1];
  const allMode = args.includes('--all');

  if (!capabilityArg && !allMode) {
    console.log('Usage:');
    console.log('  npx tsx apps/cockpit/scripts/serve-example.ts --capability=streaming');
    console.log('  npx tsx apps/cockpit/scripts/serve-example.ts --all');
    console.log('\nCapabilities:');
    capabilities.forEach((c) => console.log(`  ${c.id.padEnd(22)} port ${c.port}  ${c.product}/${c.topic}`));
    process.exit(0);
  }

  const procs: ChildProcess[] = [];

  function run(label: string, cmd: string, color: string, extraEnv: Record<string, string> = {}): void {
    const proc = spawn('bash', ['-c', cmd], { stdio: ['inherit', 'pipe', 'pipe'], env: { ...process.env, ...extraEnv } });
    proc.stdout?.on('data', (d) => String(d).split('\n').filter(Boolean).forEach((l) => console.log(`\x1b[${color}m[${label}]\x1b[0m ${l}`)));
    proc.stderr?.on('data', (d) => String(d).split('\n').filter(Boolean).forEach((l) => console.error(`\x1b[${color}m[${label}]\x1b[0m ${l}`)));
    procs.push(proc);
  }

  function cleanup() { procs.forEach((p) => p.kill()); process.exit(0); }
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  run('cockpit', 'npx nx serve cockpit --port 4201', '36', COCKPIT_RUNTIME_ENV);

  if (allMode) {
    capabilities.forEach((c) => run(c.id, `npx nx run ${c.angularProject}:serve:cockpit --port ${c.port}`, '33'));
    console.log('\n🚀 Starting cockpit + all 14 examples\n');
  } else {
    const cap = findCapability(capabilityArg!);
    if (!cap) { console.error(`Unknown: ${capabilityArg}`); process.exit(1); }
    run(cap.id, `npx nx run ${cap.angularProject}:serve:cockpit --port ${cap.port}`, '33');
    const backend = backendCommand(cap);
    if (backend) {
      run(`${cap.id}-py`, backend, '35');
      console.log(`\n🚀 ${cap.id}: cockpit=4201 angular=${cap.port} backend=${cap.pythonPort}\n`);
    } else {
      console.log(`\n🚀 ${cap.id}: cockpit=4201 angular=${cap.port} (no backend)\n`);
    }
  }
}
