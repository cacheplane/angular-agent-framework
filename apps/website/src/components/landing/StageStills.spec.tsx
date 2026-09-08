// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StageStills } from './StageStills';
import { STAGE_CLOSE, STAGE_RAIL } from '../../lib/positioning';
import type { StageBeat } from '../../lib/stage-beats';

/** Stands in for `STAGE_PROOF`: the page derives these from the recording. */
const PROOF: Record<StageBeat, string> = {
  subagents: '2 specialists',
  stream: '312 events · 1 tool call · 3 sources',
  persist: 'reloaded · 10 checkpoints · forked at step 1',
  approve: '1 interrupt pending · checkpoint 10 of 10',
  render: '1 surface · 6 components · no generated code ran',
};

describe('StageStills', () => {
  it('renders five beats in order, each with its still, phone source, and a filled beat block', () => {
    render(<StageStills proof={PROOF} />);
    const beats = screen.getAllByTestId('stage-still-beat');
    expect(beats.map((b) => b.getAttribute('data-beat'))).toEqual([
      'stream',
      'subagents',
      'persist',
      'approve',
      'render',
    ]);
    for (const [i, b] of beats.entries()) {
      const rail = STAGE_RAIL[i];
      const img = b.querySelector('img')!;
      expect(img.getAttribute('src')).toBe(
        `/screenshots/stage-${rail.beat}.webp`
      );
      expect(img.getAttribute('alt')).toBe(rail.stillAlt);
      expect(img.getAttribute('loading')).toBe('lazy');
      expect(b.querySelector('source')!.getAttribute('srcset')).toBe(
        `/screenshots/stage-${rail.beat}-mobile.webp`
      );
      // The beat block (stage-rail spec §3.2, §6): the still IS the settle,
      // so its check is always filled.
      expect(b.querySelector('.stage-check[data-checked]')).not.toBeNull();
      expect(b.querySelector('.stage-capability')!.textContent).toBe(
        rail.label
      );
      expect(b.querySelector('a.stage-doc')!.getAttribute('href')).toBe(
        rail.docs.href
      );
      expect(b.querySelector('[data-stage-proof]')).toBeNull();
      expect(b.firstElementChild?.className).toBe('stage-still-text');
    }
  });

  it('renders the install ending once after the five stills, with focusable links', () => {
    render(<StageStills proof={PROOF} />);
    const close = screen.getByTestId('stage-stills-close');
    const items = close.querySelectorAll('.stage-ledger li');
    expect(items).toHaveLength(0);
    expect(close.querySelector('.stage-claim')!.textContent).toBe(
      STAGE_CLOSE.claim
    );
    expect(close.querySelector('.stage-install code')).toBeNull();
    expect(
      close.querySelector('a.stage-install-cta')!.getAttribute('href')
    ).toBe(STAGE_CLOSE.cta.href);
    expect(close.querySelector('.stage-trust')).not.toBeNull();
    // The stills are the no-JS and phone form: nothing here is hidden, so
    // nothing is taken out of the tab order. Four beat docs links, four
    // ledger links, one CTA.
    const anchors = document.querySelectorAll('section#stage a');
    expect(anchors).toHaveLength(5 + 1);
    anchors.forEach((a) => expect(a.hasAttribute('tabindex')).toBe(false));
  });

  it('is the section the act replaces, with its anchors', () => {
    render(<StageStills proof={PROOF} />);
    expect(document.querySelector('section#stage')).not.toBeNull();
    expect(document.getElementById('stage-heading')).not.toBeNull();
    expect(
      screen.getByRole('heading', { level: 3, name: STAGE_RAIL[2].label })
    ).toBeTruthy();
  });
});
