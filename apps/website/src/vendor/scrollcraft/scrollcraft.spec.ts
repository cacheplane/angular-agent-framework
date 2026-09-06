import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Upstream commit 0b81622. See README.md beside this file before changing. */
const PINNED_SHA256 =
  '9246fbe4e240a63cdaf33111edd724ee66118da87dc44af86039b0d1619164a1';

describe('vendored scroll-craft engine', () => {
  it('is byte-identical to the pinned upstream file', () => {
    const src = readFileSync(join(__dirname, 'scrollcraft.js'));
    expect(createHash('sha256').update(src).digest('hex')).toBe(PINNED_SHA256);
  });
  it('exposes mount and never auto-mounts', () => {
    const src = readFileSync(join(__dirname, 'scrollcraft.js'), 'utf8');
    expect(src).toMatch(/global\.ScrollCraft = \{ mount: mount/);
    expect(src).not.toMatch(/DOMContentLoaded/);
  });
});
