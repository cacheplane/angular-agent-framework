// SPDX-License-Identifier: MIT
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SECTION_MEDIA } from './section-media';
import { DEMO_CDN } from './demo-media';

describe('SECTION_MEDIA', () => {
  it('declares at least one medium for every section', () => {
    for (const [key, media] of Object.entries(SECTION_MEDIA)) {
      const count = [media.video, media.code, media.live].filter(Boolean).length;
      expect(count, key).toBeGreaterThan(0);
    }
  });

  it('serves every video through the shared blob base', () => {
    for (const [key, media] of Object.entries(SECTION_MEDIA)) {
      if (!media.video) continue;
      for (const url of [media.video.videoMp4, media.video.videoWebm, media.video.poster]) {
        expect(url, key).toContain(DEMO_CDN);
      }
    }
  });

  it('gives every code pane a label and real source', () => {
    for (const [key, media] of Object.entries(SECTION_MEDIA)) {
      for (const block of media.code ?? []) {
        expect(block.label.trim().length, key).toBeGreaterThan(0);
        expect(block.source.trim().length, key).toBeGreaterThan(40);
        expect(block.source, key).not.toMatch(/TODO|FIXME/);
      }
    }
  });

  it('points every live tab at a suggestion the demo actually has', () => {
    // Cross-project on purpose. `?featured=` falls back silently for an id it
    // does not recognise, so a typo here would quietly turn a live tab back
    // into the generic empty demo — the exact thing the live tab exists to
    // avoid — and nothing else would fail. Read the demo's real list rather
    // than duplicating the ids, so renaming one there breaks this test instead
    // of breaking the homepage in production.
    const source = readFileSync(
      join(__dirname, '../../../../examples/chat/angular/src/app/modes/welcome-suggestions.ts'),
      'utf8',
    );
    const known = new Set(Array.from(source.matchAll(/id: '([^']+)'/g), (m) => m[1]));
    expect(known.size).toBeGreaterThan(0);

    for (const [key, media] of Object.entries(SECTION_MEDIA)) {
      if (!media.live) continue;
      expect(known, `${key} -> ${media.live.featured}`).toContain(media.live.featured);
    }
  });
});
