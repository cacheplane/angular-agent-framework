// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StageStills } from './StageStills';
import { STAGE_RAIL } from '../../lib/positioning';

describe('StageStills', () => {
  it('renders four beats in order, each with its still, phone source, copy rows and cta', () => {
    render(<StageStills />);
    const beats = screen.getAllByTestId('stage-still-beat');
    expect(beats.map((b) => b.getAttribute('data-beat'))).toEqual([
      'stream',
      'persist',
      'approve',
      'render',
    ]);
    for (const [i, b] of beats.entries()) {
      const img = b.querySelector('img')!;
      expect(img.getAttribute('src')).toBe(
        `/screenshots/stage-${STAGE_RAIL[i].beat}.webp`
      );
      expect(img.getAttribute('alt')).toBe(STAGE_RAIL[i].stillAlt);
      expect(img.getAttribute('loading')).toBe('lazy');
      expect(b.querySelector('source')!.getAttribute('srcset')).toBe(
        `/screenshots/stage-${STAGE_RAIL[i].beat}-mobile.webp`
      );
      expect(b.querySelectorAll('.feature-block-row')).toHaveLength(3);
      expect(b.querySelector('a.feature-block-cta')!.getAttribute('href')).toBe(
        STAGE_RAIL[i].cta.href
      );
    }
  });
  it('is the section the act replaces, with its anchors', () => {
    render(<StageStills />);
    expect(document.querySelector('section#stage')).not.toBeNull();
    expect(
      screen.getByRole('heading', { level: 3, name: STAGE_RAIL[2].headline })
    ).toBeTruthy();
  });
});
