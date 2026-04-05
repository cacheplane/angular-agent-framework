import { spawn, type ChildProcess } from 'child_process';
import { capabilities, findCapability } from './capability-registry';

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

function run(label: string, cmd: string, color: string): void {
  const proc = spawn('bash', ['-c', cmd], { stdio: ['inherit', 'pipe', 'pipe'], env: { ...process.env } });
  proc.stdout?.on('data', (d) => String(d).split('\n').filter(Boolean).forEach((l) => console.log(`\x1b[${color}m[${label}]\x1b[0m ${l}`)));
  proc.stderr?.on('data', (d) => String(d).split('\n').filter(Boolean).forEach((l) => console.error(`\x1b[${color}m[${label}]\x1b[0m ${l}`)));
  procs.push(proc);
}

function cleanup() { procs.forEach((p) => p.kill()); process.exit(0); }
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

run('cockpit', 'npx nx serve cockpit --port 4201', '36');

if (allMode) {
  capabilities.forEach((c) => run(c.id, `npx nx serve ${c.angularProject} --port ${c.port}`, '33'));
  console.log('\n🚀 Starting cockpit + all 14 examples\n');
} else {
  const cap = findCapability(capabilityArg!);
  if (!cap) { console.error(`Unknown: ${capabilityArg}`); process.exit(1); }
  run(cap.id, `npx nx serve ${cap.angularProject} --port ${cap.port}`, '33');
  run(`${cap.id}-py`, `cd ${cap.pythonDir} && source $HOME/.local/bin/env 2>/dev/null; uv sync && uv run langgraph dev --port 8123`, '35');
  console.log(`\n🚀 ${cap.id}: cockpit=4201 angular=${cap.port} langgraph=8123\n`);
}
