import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AgUiPage from './page';

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
    expect(screen.getByText('@threadplane/ag-ui · protocol adapter')).toBeTruthy();
    expect(container.querySelector('.marker-highlight')?.textContent).toBe('work the day they ship');
    expect(screen.getAllByRole('tablist').length).toBeGreaterThanOrEqual(1);
    const cta = [...container.querySelectorAll('[data-ui="section"]')].find((s) =>
      s.querySelector('.final-cta-inner'),
    );
    expect(cta?.getAttribute('data-surface')).toBe('dark');
  });
});
