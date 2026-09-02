import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RAW_MALFORMED_REQUEST_TARGETS } from './deploy-smoke';

const repoRoot = resolve(import.meta.dirname, '../../..');
const config = JSON.parse(
  readFileSync(resolve(repoRoot, 'vercel.cockpit.json'), 'utf8')
) as {
  routes?: Array<{ src?: string; status?: number }>;
};

const EXPECTED_RAW_REJECTION_PATTERN =
  '^(?:.*//.*|.*(?:\\\\|%5[cC]|%2[fF]).*|.*(?:^|/)(?:\\.{1,2}|%2[eE](?:%2[eE])?)(?:/|$).*)$';

describe('Cockpit Vercel malformed raw-path rejection', () => {
  it('places one rejection-only rule before framework routing', () => {
    expect(config.routes?.[0]).toEqual({
      src: EXPECTED_RAW_REJECTION_PATTERN,
      status: 404,
    });
    expect(config.routes).toHaveLength(1);
  });

  it('targets every raw malformed preview probe without duplicating redirects', () => {
    const pattern = new RegExp(EXPECTED_RAW_REJECTION_PATTERN, 'i');
    for (const path of RAW_MALFORMED_REQUEST_TARGETS) {
      expect(pattern.test(path), path).toBe(true);
    }
    for (const path of [
      '/',
      '/favicon.ico',
      '/langgraph/core-capabilities/streaming/overview/python',
    ]) {
      expect(pattern.test(path), path).toBe(false);
    }
    expect(JSON.stringify(config.routes)).not.toContain('threadplane.ai');
    expect(JSON.stringify(config.routes)).not.toContain('mode=');
  });
});
