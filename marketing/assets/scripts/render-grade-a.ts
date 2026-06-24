// SPDX-License-Identifier: MIT
//
// Renders the "Graded A for Trust" campaign cards (x-card + og-card) to PNG.
// Usage: npx tsx marketing/assets/scripts/render-grade-a.ts
// Output: marketing/cowork/inbox/assets/grade-a-{x,og}-card.png

import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { renderCard } from '../src/index';
import type { CardInput } from '../src/types';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', '..', 'cowork', 'inbox', 'assets');

const shared = {
  eyebrow: 'Independently graded',
  title: 'Grade A for trust.',
  subtitle: '82.8/100 · #7 of 75 agent frameworks · the only Angular one.',
} as const;

const cards: { name: string; input: CardInput }[] = [
  { name: 'grade-a-x-card.png', input: { template: 'x-card', ...shared } },
  { name: 'grade-a-og-card.png', input: { template: 'og-card', ...shared } },
];

async function main() {
  await mkdir(outDir, { recursive: true });
  for (const { name, input } of cards) {
    const { png, width, height } = await renderCard(input);
    const path = join(outDir, name);
    await writeFile(path, png);
    console.log(`rendered ${name} (${width}x${height}, ${png.length} bytes) -> ${path}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
