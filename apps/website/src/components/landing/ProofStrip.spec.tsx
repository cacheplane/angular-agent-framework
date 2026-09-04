import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ProofStrip, PROOF_CELLS } from './ProofStrip';

describe('ProofStrip', () => {
  it('renders four cells, each with a source link', () => {
    render(<ProofStrip />);
    expect(PROOF_CELLS).toHaveLength(4);
    for (const cell of PROOF_CELLS) {
      expect(screen.getByText(cell.caption)).toBeTruthy();
      const link = screen.getByRole('link', { name: cell.sourceLabel });
      expect(link.getAttribute('href')).toBe(cell.sourceHref);
    }
  });

  it('renders the HVTrust grade as a live badge image, not text', () => {
    render(<ProofStrip />);
    const badge = screen.getByAltText(/HVTrust grade/i);
    expect(badge.getAttribute('src')).toBe('https://hvtracker.net/badge/threadplane.svg');
  });

  it('renders on the dark contrast band, with a watermark carrying no text', () => {
    const { container } = render(<ProofStrip />);

    const section = container.querySelector('[data-ui="section"]');
    expect(section?.getAttribute('data-surface')).toBe('dark');
    expect(section?.getAttribute('id')).toBe('proof');

    const mark = container.querySelector('.proof-strip-watermark');
    expect(mark?.getAttribute('aria-hidden')).toBe('true');
    expect(mark?.getAttribute('data-watermark-text')).toBe('Proof');
    expect(mark?.textContent).toBe('');
  });

  it('keeps the "Reliable to the core" framing on the band', () => {
    render(<ProofStrip />);
    expect(screen.getByText('Reliable to the core')).toBeTruthy();
    const heading = screen.getByRole('heading', { name: 'Audited, scored, published.' });
    expect(heading.id).toBe('proof-heading');
  });

  it('links every number to a human-readable page, never a raw API', () => {
    for (const cell of PROOF_CELLS) {
      const { hostname, pathname } = new URL(cell.sourceHref);
      expect(hostname.startsWith('api.'), cell.sourceHref).toBe(false);
      expect(pathname.startsWith('/api/'), cell.sourceHref).toBe(false);
    }
  });
});
