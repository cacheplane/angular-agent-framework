// Standalone smoke runner for channel adapters. NOT exported by the package.
//
// Usage:
//   pnpm marketing:channels:x:auth                                    # one-time, fills .env (X only)
//   DRY_RUN=1 pnpm marketing:channels:x:smoke
//   pnpm marketing:channels:x:smoke
//   SMOKE_MEDIA=1 pnpm marketing:channels:x:smoke
//   SMOKE_THREAD=1 pnpm marketing:channels:x:smoke
//   DRY_RUN=1 pnpm marketing:channels:devto:smoke
//   pnpm marketing:channels:devto:smoke
//
// The default channel is 'x'. Override with --channel=devto.

import fs from 'node:fs';
import path from 'node:path';
import { getAdapter, type ChannelId, type Draft } from '../src';

const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=',
  'base64',
);

function parseChannel(): ChannelId {
  const arg = process.argv.find((a) => a.startsWith('--channel='));
  if (!arg) return 'x';
  const value = arg.split('=')[1];
  if (value !== 'x' && value !== 'devto') {
    throw new Error(`smoke.ts: --channel=${value} not supported. Use x or devto.`);
  }
  return value;
}

function buildXDraft(): Draft {
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

function buildDevToDraft(): Draft {
  const stamp = new Date().toISOString();
  return {
    channel: 'devto',
    text: [
      '# Marketing Pipeline Smoke Test',
      '',
      'This is an automated smoke test of the @ngaf/marketing-channels Dev.to adapter.',
      '',
      `Posted at ${stamp}. Please ignore — this article will be deleted.`,
      '',
      '## Why this exists',
      '',
      'The Cacheplane marketing pipeline syndicates blog content to Dev.to. This run verifies the live wire works end-to-end.',
    ].join('\n'),
    article: {
      title: `Marketing Pipeline Smoke Test — ${stamp}`,
      tags: ['test'],
      canonicalUrl: 'https://cacheplane.ai',
      description: 'Automated smoke test of the Cacheplane marketing pipeline Dev.to adapter.',
    },
  };
}

async function main(): Promise<void> {
  const channel = parseChannel();
  const adapter = getAdapter(channel);
  const draft = channel === 'devto' ? buildDevToDraft() : buildXDraft();
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
  } else if (channel === 'devto' && process.env.SMOKE_METRICS !== '0') {
    // Brief wait so Dev.to has time to index the article before fetching metrics.
    console.log('Sleeping 5s before fetching metrics…');
    await new Promise((r) => setTimeout(r, 5000));
    const metrics = await adapter.metrics(result.postId);
    console.log('Metrics:', JSON.stringify(metrics, null, 2));
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
