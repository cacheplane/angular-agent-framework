import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const CANONICAL_NEXT_ENV = `/// <reference types="next" />
/// <reference types="next/image-types/global" />
import "./../../dist/apps/website/.next/types/routes.d.ts";

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
`;

async function restoreNextEnv(): Promise<void> {
  await writeFile(new URL('../next-env.d.ts', import.meta.url), CANONICAL_NEXT_ENV);
}

function run(command: string, args: string[]): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => resolve(code));
  });
}

async function main(): Promise<void> {
  const separator = process.argv.indexOf('--');
  const commandLine = separator === -1 ? process.argv.slice(2) : process.argv.slice(separator + 1);
  const [command, ...args] = commandLine;

  if (!command) {
    throw new Error('Expected a command after --');
  }

  let exitCode: number | null = 1;
  try {
    exitCode = await run(command, args);
  } finally {
    await restoreNextEnv();
  }
  process.exitCode = exitCode ?? 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
