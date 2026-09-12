// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Reliability } from './Reliability';
import { HERO_TRUST_LINE } from '../../lib/positioning';

describe('Reliability', () => {
  it('opens with the trust masthead, so the yellow block closes into the dark band', () => {
    const { container } = render(<Reliability />);
    const mast = container.querySelector('.proof-masthead');
    expect(mast?.textContent).toBe(HERO_TRUST_LINE);
    // It must be the section's first child: it is the seam between the hero's
    // yellow and this band, not a line floating inside the content.
    const section = container.querySelector('[data-ui="section"]');
    expect(section?.firstElementChild).toBe(mast);
  });

  it('keeps the dark band, the id the e2e pins, the watermark, and the framing', () => {
    const { container } = render(<Reliability />);
    const section = container.querySelector('[data-ui="section"]');
    expect(section?.getAttribute('data-surface')).toBe('dark');
    expect(section?.getAttribute('id')).toBe('proof');
    const mark = container.querySelector('.proof-strip-watermark');
    expect(mark?.getAttribute('aria-hidden')).toBe('true');
    expect(mark?.getAttribute('data-watermark-text')).toBe('Proof');
    expect(mark?.textContent).toBe('');
    expect(screen.getByText('Climb performance')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Audited, scored, published.' }).id).toBe('proof-heading');
    // The public-copy contract scan reads only content/**, so component copy is
    // guarded here alone: a sourced score is not a customer claim.
    expect(container.textContent).not.toMatch(/trusted by|customers|our clients|powered by/i);
  });

  it('frames the list as third-party proof', () => {
    const { container } = render(<Reliability />);
    expect(screen.getByText('Climb performance')).toBeTruthy();
    expect(
      screen.getByText('Not self-reported. Every figure links to the body that published it.'),
    ).toBeTruthy();
    expect(container.querySelector('.preflight')).toBeTruthy();
    // The two-column checklist and its predecessors are gone.
    expect(container.querySelector('.preflight-cols')).toBeNull();
    expect(container.querySelector('.proof-ladder')).toBeNull();
    expect(container.querySelector('.proof-strip-cells')).toBeNull();
  });
});
