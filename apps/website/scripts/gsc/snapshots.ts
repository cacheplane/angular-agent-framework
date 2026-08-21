// SPDX-License-Identifier: MIT
import fs from 'node:fs';
import path from 'node:path';

/**
 * Read one snapshot file written by `pull.ts`. The overwhelmingly likely error
 * is running the report before the pull, so say that in the message instead of
 * surfacing a raw ENOENT stack.
 */
export function read<T>(dir: string, name: string): T {
  const file = path.join(dir, name);
  let raw: string;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Missing snapshot ${file}. Run \`npm run gsc:pull\` first.`);
    }
    throw error;
  }
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new Error(
      `Malformed JSON in ${file}: ${(error as Error).message}. Re-run \`npm run gsc:pull\`.`,
    );
  }
}

/**
 * Like {@link read}, for a file `pull.ts` writes only on a partial sweep.
 * Genuine absence is `null`; every other failure — malformed JSON, permissions —
 * still throws. The existence check is deliberate: `read` now reports a missing
 * file as a friendly Error, so `.code` is no longer available to discriminate on.
 */
export function readOptional<T>(dir: string, name: string): T | null {
  if (!fs.existsSync(path.join(dir, name))) {
    return null;
  }
  return read<T>(dir, name);
}
