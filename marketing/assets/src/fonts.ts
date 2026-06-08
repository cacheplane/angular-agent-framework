// SPDX-License-Identifier: MIT
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export interface SatoriFont {
  name: string;
  data: Buffer;
  weight: 400 | 600 | 700;
  style: 'normal';
}

let cached: SatoriFont[] | null = null;

export async function loadFonts(): Promise<SatoriFont[]> {
  if (cached) return cached;
  const here = dirname(fileURLToPath(import.meta.url));
  const fontsDir = join(here, '..', 'fonts');
  const [garamond, interReg, interSemi] = await Promise.all([
    readFile(join(fontsDir, 'EBGaramond-Bold.ttf')),
    readFile(join(fontsDir, 'Inter-Regular.ttf')),
    readFile(join(fontsDir, 'Inter-SemiBold.ttf')),
  ]);
  cached = [
    { name: 'EB Garamond', data: garamond, weight: 700, style: 'normal' },
    { name: 'Inter', data: interReg, weight: 400, style: 'normal' },
    { name: 'Inter', data: interSemi, weight: 600, style: 'normal' },
  ];
  return cached;
}
