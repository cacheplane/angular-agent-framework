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
  it('makes the headline alone the section heading', () => {
    const { container } = render(<OpenSourceStrip />);
    const heading = screen.getByRole('heading', { level: 2 });
    // Two words, not a sentence: the section's accessible name is the offer.
    expect(heading.textContent).toBe(OPEN_SOURCE_STRIP.headline);
    expect(heading.querySelector('em')).toBeNull();
    // The eyebrow stays readable rather than aria-hidden, matching how
    // SectionHeader treats its own eyebrows.
    expect(container.querySelector('.open-source-strip-eyebrow')?.textContent).toBe(
      OPEN_SOURCE_STRIP.eyebrow,
    );
  });

  it('names the section by that heading', () => {
    const { container } = render(<OpenSourceStrip />);
    const section = container.querySelector('[data-ui="section"]');
    expect(section?.getAttribute('aria-labelledby')).toBe('open-source-heading');
    expect(container.querySelector('#open-source-heading')).toBeTruthy();
  });

  it('sits on the dark surface at the FULL rhythm, not the tight one', () => {
    const { container } = render(<OpenSourceStrip />);
    const section = container.querySelector('[data-ui="section"]');
    expect(section?.getAttribute('data-surface')).toBe('dark');
    // Deliberately absent. This band used to be the page's quiet beat and a
    // guard here asserted data-tight="true" to keep it that way; the section
    // is now a full stop, and it gets its ~461px from the standard section
    // padding rather than from any override of its own.
    expect(section?.getAttribute('data-tight')).toBeNull();
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

  it('offers one action and no second CTA', () => {
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

  it('marks the runway decorative and puts it outside the container', () => {
    const { container } = render(<OpenSourceStrip />);
    const runway = container.querySelector('.open-source-strip-runway');
    expect(runway?.getAttribute('aria-hidden')).toBe('true');
    expect(runway?.textContent).toBe('');
    // It spans the section, not the container, so it must not be nested in
    // one — inside, the container's gutters would clip the marking short.
    expect(runway?.closest('[data-ui="container"]')).toBeNull();
    expect(runway?.parentElement?.getAttribute('data-ui')).toBe('section');
  });
});
