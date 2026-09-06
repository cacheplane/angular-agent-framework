#!/usr/bin/env node
/**
 * Runs scroll-craft's shoot.mjs against a running website (spec §8) and fails
 * on what the harness reports as defects: DEAD SCROLL outside the declared
 * hold (`data-sc-verify-hold="true"`), and cues that never peak.
 *
 *   node apps/website/e2e/scroll-craft/verify-home.mjs --url http://127.0.0.1:4308 --out <dir> [--modes desktop,phone,reduced]
 *
 * Each mode writes its frames, report.json and sheet.png under <out>/<mode>.
 *
 * The default is the desktop pass only. Below 1024px and under reduced motion
 * the page renders the stills (no pinned act, no engine), and the vendored
 * harness waits for the engine's `html.sc-ready` signal before it samples, so
 * the phone and reduced-motion passes time out on the stills page as it is
 * today. They stay defined here for a page that does raise that signal; pass
 * `--modes desktop,phone,reduced` to run them.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(name);
  return i > -1 && argv[i + 1] ? argv[i + 1] : fallback;
};
const URL = arg('--url', 'http://127.0.0.1:4308');
const OUT = path.resolve(arg('--out', 'dist/stage-shots'));
const shoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'shoot.mjs'
);

const MODES = {
  desktop: ['--width', '1440', '--height', '900'],
  phone: ['--width', '390', '--height', '844'],
  reduced: ['--reduced-motion'],
};
const modes = arg('--modes', 'desktop')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);
const unknown = modes.filter((m) => !(m in MODES));
if (unknown.length) {
  console.error(
    `unknown mode(s): ${unknown.join(', ')} (known: ${Object.keys(MODES).join(
      ', '
    )})`
  );
  process.exit(2);
}

// Verbatim summary lines from shoot.mjs. Anchored to line starts so prose in
// the harness's own commentary can never trip them.
const DEAD_SCROLL = /^DEAD SCROLL between:/m;
const CUES_NEVER_PEAK = /^CUES THAT NEVER PEAK:/m;

let failed = false;
for (const mode of modes) {
  const result = spawnSync(
    process.execPath,
    [
      shoot,
      '--url',
      URL,
      '--out',
      path.join(OUT, mode),
      '--per-act',
      '8',
      ...MODES[mode],
    ],
    { encoding: 'utf8' }
  );
  const out = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  console.log(`\n=== ${mode} ===\n${out}`);
  const reasons = [];
  if (result.status !== 0) reasons.push(`exit status ${result.status}`);
  if (DEAD_SCROLL.test(out)) reasons.push('dead scroll');
  if (CUES_NEVER_PEAK.test(out)) reasons.push('cues that never peak');
  if (reasons.length) {
    failed = true;
    console.log(`=== ${mode}: FAILED (${reasons.join(', ')})`);
  } else {
    console.log(`=== ${mode}: ok`);
  }
}
process.exit(failed ? 1 : 0);
