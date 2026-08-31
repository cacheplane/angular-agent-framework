import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ProofStrip, PROOF_CELLS } from './ProofStrip';

describe('ProofStrip', () => {
  it('renders three cells, each with a source link', () => {
    render(<ProofStrip />);
    expect(PROOF_CELLS).toHaveLength(3);
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
});
