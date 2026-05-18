// Standalone smoke runner for the X adapter. NOT exported by the package.
// Usage:
//   pnpm marketing:channels:x:auth          # one-time, fills .env
//   DRY_RUN=1 npx tsx marketing/channels/scripts/smoke.ts
//   npx tsx marketing/channels/scripts/smoke.ts
//   SMOKE_MEDIA=1 npx tsx marketing/channels/scripts/smoke.ts
//   SMOKE_THREAD=1 npx tsx marketing/channels/scripts/smoke.ts

import fs from 'node:fs';
import path from 'node:path';
import { getAdapter, type Draft } from '../src';

// 1x1 transparent PNG.
const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=',
  'base64',
);

function buildDraft(): Draft {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  if (process.env.SMOKE_THREAD === '1') {
    return {
      channel: 'x',
      threadParts: [
        `Marketing pipeline smoke test — please ignore. (${stamp}) [1/2]`,
        'This is the second tweet of the smoke thread. [2/2]',
      ],
    };
  }
  if (process.env.SMOKE_MEDIA === '1') {
    return {
      channel: 'x',
      text: `Marketing pipeline smoke test with media — please ignore. (${stamp})`,
      media: [{ png: PIXEL_PNG, alt: 'A 1x1 transparent pixel — test image.' }],
    };
  }
  return {
    channel: 'x',
    text: `Marketing pipeline smoke test — please ignore. (${stamp})`,
  };
}

async function main(): Promise<void> {
  const adapter = getAdapter('x');
  const draft = buildDraft();
  const result = await adapter.post(draft);
  console.log(JSON.stringify(result, null, 2));
  if (result.url.startsWith('https://dry-run.local')) {
    const outFile = path.join(
      process.cwd(),
      'marketing',
      'cowork',
      'outbox',
      'dry-runs',
      `${result.postId}.json`,
    );
    if (fs.existsSync(outFile)) console.log(`Dry-run file written: ${outFile}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
