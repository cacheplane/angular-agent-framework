/**
 * NOT a test. Drives /stage?record=1 (the four-beat script against the live
 * agent, wrapped in StageRecordingTransport) and writes public/stage-replay.json.
 * Run through record-stage-live.config.ts with the backend on :2024 and the
 * dev server on :4200 already up. Takes vary; commit a complete one and never
 * edit its prose.
 */
import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT = resolve(__dirname, '../public/stage-replay.json');
/* eslint-disable @typescript-eslint/no-explicit-any */

test('record stage fixture', async ({ page }) => {
  page.on('console', (m) => { console.log(`[browser:${m.type()}]`, m.text()); });
  await page.goto('/stage?record=1');
  await expect.poll(async () => page.evaluate(() => (window as any).__stageRecording?.runs.length ?? 0), { timeout: 400_000 }).toBe(7);
  let last = -1;
  for (let i = 0; i < 40; i++) {
    const n = await page.evaluate(() => (window as any).__stageRecording?.runs.at(-1)?.events.length ?? 0);
    if (n > 0 && n === last) break;
    last = n;
    await page.waitForTimeout(3000);
  }
  // Let the final run-close history refresh land before reading.
  await page.waitForTimeout(2000);
  const rec = await page.evaluate(() => (window as any).__stageRecording);
  expect(rec.runs.map((r: any) => `${r.beat}:${r.action.kind}`)).toEqual([
    'stream:submit', 'persist:reload', 'persist:submit', 'persist:submit', 'approve:submit', 'approve:resume', 'render:submit',
  ]);
  expect(rec.threadId).toBeTruthy();
  writeFileSync(OUT, JSON.stringify(rec, null, 2) + '\n');
  console.log(`wrote ${OUT}`);
});
