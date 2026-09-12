// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NoRuntimeBand } from './NoRuntimeBand';
import { NO_RUNTIME_BAND } from '../../lib/positioning';

const trackCtaClickMock = vi.hoisted(() => vi.fn());
vi.mock('../../lib/analytics/client', () => ({
  track: vi.fn(),
  trackCtaClick: trackCtaClickMock,
  trackExternalLinkClick: vi.fn(),
}));

beforeEach(() => trackCtaClickMock.mockClear());

describe('NoRuntimeBand', () => {
  it('makes the two-word headline the section heading and names the section by it', () => {
    const { container } = render(<NoRuntimeBand />);
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading.textContent).toBe(NO_RUNTIME_BAND.headline);
    expect(heading.id).toBe('no-runtime-heading');
    const section = container.querySelector('[data-ui="section"]');
    expect(section?.getAttribute('aria-labelledby')).toBe('no-runtime-heading');
    expect(section?.getAttribute('id')).toBe('no-runtime');
    expect(container.querySelector('.no-runtime-eyebrow')?.textContent).toBe(NO_RUNTIME_BAND.eyebrow);
    expect(screen.getByText(NO_RUNTIME_BAND.body)).toBeTruthy();
  });

  it('sits on the dark surface at the full rhythm, like Fork us', () => {
    const { container } = render(<NoRuntimeBand />);
    const section = container.querySelector('[data-ui="section"]');
    expect(section?.getAttribute('data-surface')).toBe('dark');
    expect(section?.getAttribute('data-tight')).toBeNull();
    expect(section?.classList.contains('no-runtime')).toBe(true);
  });

  it('offers one text link and no button, and reports it as a homepage CTA', () => {
    const { container } = render(<NoRuntimeBand />);
    const links = container.querySelectorAll('a');
    expect(links).toHaveLength(1);
    const link = screen.getByRole('link', { name: NO_RUNTIME_BAND.link.label });
    expect(link.getAttribute('href')).toBe(NO_RUNTIME_BAND.link.href);
    expect(container.querySelector('[data-ui="button"]')).toBeNull();
    fireEvent.click(link);
    expect(trackCtaClickMock).toHaveBeenCalledWith({
      cta_id: 'home_no_runtime_docs',
      track: 'developer',
      surface: 'home',
      destination_url: NO_RUNTIME_BAND.link.href,
    });
  });

  it('draws both flows from the copy module, with the ghost hop only in the usual one', () => {
    const { container } = render(<NoRuntimeBand />);
    const usual = container.querySelector('[data-flow="usual"]');
    const ours = container.querySelector('[data-flow="ours"]');
    expect(
      Array.from(usual!.querySelectorAll('.no-runtime-node')).map((n) => n.textContent),
    ).toEqual([...NO_RUNTIME_BAND.flows.usual.nodes]);
    expect(
      Array.from(ours!.querySelectorAll('.no-runtime-node')).map((n) => n.textContent),
    ).toEqual([...NO_RUNTIME_BAND.flows.ours.nodes]);
    expect(container.querySelectorAll('.no-runtime-node.is-ghost')).toHaveLength(1);
    expect(usual!.querySelector('.no-runtime-node.is-ghost')?.textContent).toBe(
      NO_RUNTIME_BAND.flows.usual.ghost,
    );
    expect(ours!.querySelector('.is-ghost')).toBeNull();
  });

  it('gives the flows a prose caption and hides the arrows from assistive tech', () => {
    const { container } = render(<NoRuntimeBand />);
    const figure = container.querySelector('figure.no-runtime-figure');
    expect(figure).toBeTruthy();
    expect(figure?.querySelector('figcaption')?.textContent).toBe(NO_RUNTIME_BAND.figureCaption);
    // The drawn flows duplicate the caption, so they are hidden as a unit.
    expect(figure?.querySelector('.no-runtime-flows')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('marks the runway decorative and puts it outside the container', () => {
    const { container } = render(<NoRuntimeBand />);
    const runway = container.querySelector('.no-runtime-runway');
    expect(runway?.getAttribute('aria-hidden')).toBe('true');
    expect(runway?.closest('[data-ui="container"]')).toBeNull();
    expect(runway?.parentElement?.getAttribute('data-ui')).toBe('section');
  });
});
