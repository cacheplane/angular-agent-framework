// Renders sample cards to marketing/assets/preview/ for manual eyeballing.
// Run: npx tsx --tsconfig marketing/assets/tsconfig.lib.json marketing/assets/scripts/preview.ts
// (the --tsconfig flag points tsx at the JSX runtime config for the .tsx templates)
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { renderCard, type CardInput } from '../src';

const samples: { name: string; input: CardInput }[] = [
  {
    name: 'x-card-basic',
    input: { template: 'x-card', title: 'Build a streaming chat UI in Angular with LangGraph' },
  },
  {
    name: 'x-card-subtitle',
    input: {
      template: 'x-card',
      title: 'Build a streaming chat UI in Angular',
      subtitle: 'Signal-native streaming, wired to a LangGraph backend.',
    },
  },
  {
    name: 'og-card-basic',
    input: { template: 'og-card', title: 'Agent UI for Angular' },
  },
  {
    name: 'og-card-author',
    input: {
      template: 'og-card',
      title: 'Notes from Cacheplane',
      subtitle: 'Production patterns for agent UI.',
      author: { name: 'Brian Love', role: 'Founder, Cacheplane' },
    },
  },
];

async function main(): Promise<void> {
  const outDir = join(process.cwd(), 'marketing', 'assets', 'preview');
  await mkdir(outDir, { recursive: true });
  for (const s of samples) {
    const card = await renderCard(s.input);
    const file = join(outDir, `${s.name}.png`);
    await writeFile(file, card.png);
    console.log(`wrote ${file} (${card.width}x${card.height}, ${card.png.byteLength} bytes)`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
