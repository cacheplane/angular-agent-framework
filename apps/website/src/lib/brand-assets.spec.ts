import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RETIRED_POSITIONING } from './public-copy-contract';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..');

/**
 * Artifacts that state the product's positioning but are not generated from
 * `positioning.ts`. Each is a file a human has to remember to update, which
 * is exactly why this test exists: the README banner and the whitepaper cover
 * both went months asserting a tagline that had been replaced.
 */
const BRAND_ASSETS = [
  'README.md',
  'apps/website/public/assets/hero.svg',
  'apps/website/public/whitepaper-preview.html',
  'apps/website/scripts/generate-whitepaper.ts',
  'libs/a2ui/README.md',
  'libs/ag-ui/README.md',
  'libs/chat/README.md',
  'libs/langgraph/README.md',
  'libs/middleware/README.md',
  'libs/render/README.md',
  'libs/telemetry/README.md',
];

describe('brand assets carry current positioning', () => {
  it.each(BRAND_ASSETS)('%s states no retired positioning', (relative) => {
    const text = readFileSync(join(REPO_ROOT, relative), 'utf8');
    const found = RETIRED_POSITIONING.filter((phrase) => text.includes(phrase));
    expect(found, `${relative} still says: ${found.join(', ')}`).toEqual([]);
  });

  it('names phrases to look for, so the scan cannot pass by being empty', () => {
    // A guard whose list is empty passes every file and reports nothing. This
    // is the mutation check the list itself cannot perform.
    expect(RETIRED_POSITIONING.length).toBeGreaterThan(3);
  });
});
