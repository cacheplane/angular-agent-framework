// SPDX-License-Identifier: MIT
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

let cached: string | null = null;

export async function loadPlaneDataUri(): Promise<string> {
  if (cached) return cached;
  const here = dirname(fileURLToPath(import.meta.url));
  const png = await readFile(join(here, '..', 'brand', 'plane.png'));
  cached = `data:image/png;base64,${png.toString('base64')}`;
  return cached;
}
