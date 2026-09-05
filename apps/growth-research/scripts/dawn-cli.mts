import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.versions.node.split('.')[0] !== '24') throw new Error('Growth research requires Node 24');
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(appRoot, 'package.json'));
const cli = require.resolve('@dawn-ai/cli');
const metadata = JSON.parse(readFileSync(resolve(dirname(cli), '../package.json'), 'utf8'));
if (metadata.version !== '0.8.24') throw new Error(`Expected app-local Dawn CLI 0.8.24, resolved ${metadata.version}`);
const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], { cwd: appRoot, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
