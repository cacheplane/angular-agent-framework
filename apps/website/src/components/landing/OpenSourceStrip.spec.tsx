// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenSourceStrip } from './OpenSourceStrip';
import { GITHUB_REPO_URL, OPEN_SOURCE_STRIP } from '../../lib/positioning';

const trackCtaClickMock = vi.hoisted(() => vi.fn());
vi.mock('../../lib/analytics/client', () => ({
  track: vi.fn(),
  trackCtaClick: trackCtaClickMock,
  trackExternalLinkClick: vi.fn(),
}));

beforeEach(() => trackCtaClickMock.mockClear());

describe('OpenSourceStrip', () => {
  it('renders the whole sentence as the section heading, emphasis included', () => {
    render(<OpenSourceStrip />);
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading.textContent).toBe(
      `${OPEN_SOURCE_STRIP.lead} ${OPEN_SOURCE_STRIP.emphasis}`,
    );
    expect(heading.querySelector('em')?.textContent).toBe(OPEN_SOURCE_STRIP.emphasis);
  });

  it('names the section by that heading', () => {
    const { container } = render(<OpenSourceStrip />);
    const section = container.querySelector('[data-ui="section"]');
    expect(section?.getAttribute('aria-labelledby')).toBe('open-source-heading');
    expect(container.querySelector('#open-source-heading')).toBeTruthy();
  });

  it('sits on the dark surface at the tight rhythm', () => {
    const { container } = render(<OpenSourceStrip />);
    const section = container.querySelector('[data-ui="section"]');
    expect(section?.getAttribute('data-surface')).toBe('dark');
    // The strip's own padding override keys off [data-tight]; dropping the
    // prop silently restores the full 48-80px band this replaced.
    expect(section?.getAttribute('data-tight')).toBe('true');
    expect(section?.classList.contains('open-source-strip')).toBe(true);
  });

  it('links the repo in a new tab, with the mark beside the label', () => {
    const { container } = render(<OpenSourceStrip />);
    const link = screen.getByRole('link', { name: OPEN_SOURCE_STRIP.cta });
    expect(link.getAttribute('href')).toBe(GITHUB_REPO_URL);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    // The mark is decorative: the accessible name above must stay the label
    // alone, so the svg has to be hidden rather than merely unlabelled.
    const svg = link.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('.open-source-strip-licence')?.textContent).toBe(
      OPEN_SOURCE_STRIP.licence,
    );
  });

  it('is the page’s quiet beat: one action, no second CTA', () => {
    const { container } = render(<OpenSourceStrip />);
    expect(container.querySelectorAll('a').length).toBe(1);
  });

  it('reports the fork click as a homepage CTA', () => {
    render(<OpenSourceStrip />);
    fireEvent.click(screen.getByRole('link', { name: OPEN_SOURCE_STRIP.cta }));
    expect(trackCtaClickMock).toHaveBeenCalledWith({
      cta_id: 'hero_github',
      track: 'developer',
      surface: 'home',
      destination_url: GITHUB_REPO_URL,
    });
  });
});
