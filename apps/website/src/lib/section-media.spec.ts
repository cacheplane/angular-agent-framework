// SPDX-License-Identifier: MIT
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
});
