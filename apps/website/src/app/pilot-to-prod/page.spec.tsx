import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PilotToProdPage from './page';

vi.mock('../../lib/analytics/client', () => ({
  track: vi.fn(),
  trackCtaClick: vi.fn(),
  trackExternalLinkClick: vi.fn(),
  trackWhitepaperDownloadClick: vi.fn(),
}));

describe('PilotToProdPage', () => {
  it('renders rail-kicked section headers and the outcomes ledger', () => {
    const { container } = render(<PilotToProdPage />);
    expect(container.querySelectorAll('.pilot-rail2')).toHaveLength(1);
    expect(container.querySelectorAll('.pilot-outcome-row')).toHaveLength(4);
    expect(container.querySelectorAll('.pilot-outcomes-grid')).toHaveLength(0);
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
  });
});
