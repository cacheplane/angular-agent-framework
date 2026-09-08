// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Reliability, PROOF_CELLS } from './Reliability';
import { HERO_TRUST_LINE, RELIABILITY_RECEIPTS } from '../../lib/positioning';

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

  it('renders four cells, each with a source link', () => {
    render(<Reliability />);
    expect(PROOF_CELLS).toHaveLength(4);
    for (const cell of PROOF_CELLS) {
      expect(screen.getByText(cell.caption)).toBeTruthy();
      expect(screen.getByRole('link', { name: cell.sourceLabel }).getAttribute('href')).toBe(cell.sourceHref);
    }
  });

  it('renders the HVTrust grade as a live badge image, not text', () => {
    render(<Reliability />);
    expect(screen.getByAltText(/HVTrust grade/i).getAttribute('src')).toBe('https://hvtracker.net/badge/threadplane.svg');
  });

  it('renders three receipts under the cells, each with a source link', () => {
    render(<Reliability />);
    const list = screen.getByRole('list', { name: 'Receipts' });
    expect(list.querySelectorAll('li')).toHaveLength(3);
    for (const r of RELIABILITY_RECEIPTS) {
      expect(screen.getByText(r.claim)).toBeTruthy();
      expect(screen.getByText(r.detail)).toBeTruthy();
      const link = screen.getByRole('link', { name: r.sourceLabel });
      expect(link.getAttribute('href')).toBe(r.sourceHref);
      const external = r.sourceHref.startsWith('http');
      expect(link.getAttribute('target')).toBe(external ? '_blank' : null);
      expect(link.getAttribute('rel')).toBe(external ? 'noopener noreferrer' : null);
    }
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
  });

  it('frames the section as a climb and hides the instrument from assistive tech', () => {
    const { container } = render(<Reliability />);
    expect(
      screen.getByText(/Vx clears today’s obstacle; Vy gets you to altitude\./),
    ).toBeTruthy();
    const ladder = container.querySelector('.proof-ladder');
    expect(ladder?.getAttribute('aria-hidden')).toBe('true');
    // The words carry the argument; the drawing carries none of it.
    expect(ladder?.textContent).toBe('');
  });

  it('orders the ladder, cells, then receipts', () => {
    const { container } = render(<Reliability />);
    const children = container.querySelector('.proof-strip-grid')!.children;
    expect(children[1].getAttribute('class')).toBe('proof-ladder');
    expect(children[2].className).toBe('proof-strip-cells');
    expect(children[3].className).toBe('reliability-receipts');
    expect(children).toHaveLength(4);
  });

  it('links every number and receipt to a human-readable page, never a raw API', () => {
    for (const href of [...PROOF_CELLS.map((c) => c.sourceHref), ...RELIABILITY_RECEIPTS.map((r) => r.sourceHref)]) {
      const { hostname, pathname } = new URL(href, 'https://threadplane.ai');
      expect(hostname.startsWith('api.'), href).toBe(false);
      expect(pathname.startsWith('/api/'), href).toBe(false);
    }
  });
});
