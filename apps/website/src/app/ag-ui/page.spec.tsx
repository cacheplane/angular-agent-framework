import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('server-only', () => ({}));
import AgUiPage from './page';
import { BACKENDS } from '../../components/landing/ag-ui/BackendsGrid';

vi.mock('../../lib/analytics/client', () => ({
  track: vi.fn(),
  trackCtaClick: vi.fn(),
  trackExternalLinkClick: vi.fn(),
  trackWhitepaperDownloadClick: vi.fn(),
}));

describe('AgUiPage', () => {
  it('renders the package kicker, marker sweep, switcher, and dark closer', async () => {
    const ui = await AgUiPage();
    const { container } = render(ui);
        // The H1/subtitle/body say "seven"; this pins the grid to that word.
    expect(BACKENDS).toHaveLength(7);
    expect(screen.getByText('@threadplane/ag-ui · protocol adapter')).toBeTruthy();
    expect(container.querySelector('.marker-highlight')?.textContent).toBe('work the day they ship');
    expect(screen.getAllByRole('tablist').length).toBeGreaterThanOrEqual(1);
    const cta = [...container.querySelectorAll('[data-ui="section"]')].find((s) =>
      s.querySelector('.final-cta-inner'),
    );
    expect(cta?.getAttribute('data-surface')).toBe('dark');
  });
});
