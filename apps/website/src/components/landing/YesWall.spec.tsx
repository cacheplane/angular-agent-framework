import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { YesWall, YES_WALL_GROUPS } from './YesWall';

vi.mock('../../lib/analytics/client', () => ({
  trackCtaClick: vi.fn(),
}));

describe('YesWall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders 15 questions across 4 groups', () => {
    render(<YesWall />);
    const total = YES_WALL_GROUPS.reduce((n, g) => n + g.rows.length, 0);
    expect(YES_WALL_GROUPS).toHaveLength(4);
    expect(total).toBe(15);
    for (const group of YES_WALL_GROUPS) {
      expect(screen.getByText(group.label)).toBeTruthy();
      for (const row of group.rows) {
        expect(screen.getByText(row.question)).toBeTruthy();
        expect(screen.getByText(row.api)).toBeTruthy();
      }
    }
  });

  it('answers every question Yes', () => {
    render(<YesWall />);
    expect(screen.getAllByText('Yes')).toHaveLength(15);
  });

  it('renders the dark specimen chrome', () => {
    const { container } = render(<YesWall />);
    expect(
      container.querySelector('[data-ui="section"]')?.getAttribute('data-surface'),
    ).toBe('dark');
    const mark = container.querySelector('.yes-wall-watermark');
    expect(mark?.getAttribute('aria-hidden')).toBe('true');
  });

  it('links the footer to the docs', () => {
    render(<YesWall />);
    const link = screen.getByRole('link', { name: /Every question answered/ });
    expect(link.getAttribute('href')).toBe('/docs');
  });
});

describe('YesWall promise surface', () => {
  it('makes no installation or phone-home claim', () => {
    render(<YesWall />);

    const wall = document.body.textContent ?? '';
    expect(wall).not.toMatch(/phon(e|ing) home/i);
    expect(wall).not.toMatch(/installation is inert/i);
    expect(
      YES_WALL_GROUPS.flatMap((group) => group.rows).map((row) => row.question)
    ).not.toContain('Can I install it without phoning home?');
  });
});
