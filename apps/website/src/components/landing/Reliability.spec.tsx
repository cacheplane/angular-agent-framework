// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Reliability, PROOF_CELLS, RIBBON_ITEMS, RIBBON_MORE_COUNT } from './Reliability';
import { RELIABILITY_RECEIPTS } from '../../lib/positioning';

describe('Reliability', () => {
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
      expect(screen.getByRole('link', { name: r.sourceLabel }).getAttribute('href')).toBe(r.sourceHref);
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
    expect(screen.getByText('Reliable to the core')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Audited, scored, published.' }).id).toBe('proof-heading');
  });

  it('carries the works-with line as a compatibility claim with an adapter link', () => {
    const { container } = render(<Reliability />);
    expect(RIBBON_ITEMS).toHaveLength(8);
    expect(screen.getByText('Works with')).toBeTruthy();
    for (const item of RIBBON_ITEMS) expect(screen.getByText(item.name)).toBeTruthy();
    expect(screen.getByText(`+ ${RIBBON_MORE_COUNT} more`)).toBeTruthy();
    for (const img of Array.from(container.querySelectorAll('img.reliability-logo'))) {
      expect(img.getAttribute('aria-hidden')).toBe('true');
      expect(img.getAttribute('alt')).toBe('');
    }
    expect(container.textContent).not.toMatch(/trusted by|customers|our clients|powered by/i);
    expect(screen.getByRole('link', { name: 'Choose an adapter →' }).getAttribute('href')).toBe('/docs/choosing-an-adapter');
  });

  it('links every number and receipt to a human-readable page, never a raw API', () => {
    for (const href of [...PROOF_CELLS.map((c) => c.sourceHref), ...RELIABILITY_RECEIPTS.map((r) => r.sourceHref)]) {
      const { hostname, pathname } = new URL(href, 'https://threadplane.ai');
      expect(hostname.startsWith('api.'), href).toBe(false);
      expect(pathname.startsWith('/api/'), href).toBe(false);
    }
  });
});
