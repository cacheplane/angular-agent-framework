import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('server-only', () => ({}));
import SolutionPage from './page';
import { getAllSolutionSlugs } from '../../../lib/solutions-data';

vi.mock('../../../lib/analytics/client', () => ({
  track: vi.fn(),
  trackCtaClick: vi.fn(),
  trackExternalLinkClick: vi.fn(),
}));

vi.mock('../../../components/solutions/SolutionCodeBlock', () => ({
  SolutionCodeBlock: () => null,
}));

vi.mock('../../../components/solutions/SolutionDemoBlock', () => ({
  SolutionDemoBlock: () => null,
}));

describe('SolutionPage', () => {
  it('renders navy rails with no per-solution accent theming', async () => {
    const slug = getAllSolutionSlugs()[0];
    const ui = await SolutionPage({ params: Promise.resolve({ slug }) });
    const { container } = render(ui);
    expect(container.querySelectorAll('[data-accent-text]')).toHaveLength(0);
    expect(container.querySelectorAll('[style*="--accent"]')).toHaveLength(0);
    expect(container.querySelectorAll('.sol-page-rail').length).toBeGreaterThanOrEqual(3);
    expect(container.querySelector('.sol-page-metric')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
  });
});
