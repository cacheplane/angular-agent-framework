// SPDX-License-Identifier: MIT
/**
 * NOT a test. Drives /hero?record=1 (the scripted walkthrough runs against the
 * live agent wrapped in HeroRecordingTransport) and writes the captured runs
 * to public/hero-replay.json. Run through record-hero.config.ts.
 */
import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface RecordingShape {
  version: 1;
  recordedAt: string;
  runs: { label: string; events: { tMs: number; event: unknown }[] }[];
}
/* eslint-disable @typescript-eslint/no-explicit-any */
const readRecording = () => (window as any).__heroRecording as RecordingShape | undefined;

const OUT = resolve(__dirname, '../public/hero-replay.json');

test('record hero walkthrough fixture', async ({ page }) => {
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('[browser]', m.text());
  });
  await page.goto('/hero?record=1');
  await expect
    .poll(async () => page.evaluate(() => (window as any).__heroRecording?.runs.length ?? 0), {
      timeout: 200_000,
    })
    .toBe(3);
  // Let the last run drain: wait until the genui run has stopped growing for 3s.
  let last = -1;
  for (let i = 0; i < 40; i++) {
    const n = await page.evaluate(() => (window as any).__heroRecording?.runs[2]?.events.length ?? 0);
    if (n > 0 && n === last) break;
    last = n;
    await page.waitForTimeout(3000);
  }
  const rec = (await page.evaluate(readRecording)) as RecordingShape | undefined;
  expect(rec?.runs.map((r) => r.label)).toEqual(['prompt', 'resume', 'genui']);
  expect(JSON.stringify(rec?.runs[0].events)).toMatch(/approval_request/);
  expect(JSON.stringify(rec?.runs[2].events)).toMatch(/a2ui/i);
  writeFileSync(OUT, JSON.stringify(rec, null, 2) + '\n');
  console.log(`wrote ${OUT}`);
});
