// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { mdxHeadingComponents } from './headings';

const { h2: H2, h3: H3 } = mdxHeadingComponents;

describe('mdx heading components', () => {
  it('extracts H2 text with no anchor glyph anywhere in it', () => {
    const { container } = render(<H2 id="prerequisites">Prerequisites</H2>);
    const heading = container.querySelector('h2');

    expect(heading?.textContent).toBe('Prerequisites');
    expect(heading?.textContent).not.toContain('#');
  });

  it('extracts H3 text with no anchor glyph anywhere in it', () => {
    const { container } = render(<H3 id="troubleshooting">Troubleshooting</H3>);
    const heading = container.querySelector('h3');

    expect(heading?.textContent).toBe('Troubleshooting');
    expect(heading?.textContent).not.toContain('#');
  });

  it('keeps a numbered heading clean (the live-site regression case)', () => {
    const { container } = render(<H2 id="1-install-the-packages">1. Install the packages</H2>);

    expect(container.querySelector('h2')?.textContent).toBe('1. Install the packages');
  });

  it('still renders a labelled, keyboard-reachable permalink after the text', () => {
    const { container } = render(<H2 id="prerequisites">Prerequisites</H2>);
    const anchor = container.querySelector('a.heading-anchor') as HTMLAnchorElement | null;

    expect(anchor).not.toBeNull();
    expect(anchor?.getAttribute('href')).toBe('#prerequisites');
    expect(anchor?.getAttribute('aria-label')).toBe('Link to prerequisites');
    // Reachable by keyboard: not hidden from assistive tech, not removed from tab order.
    expect(anchor?.getAttribute('aria-hidden')).toBeNull();
    expect(anchor?.getAttribute('tabindex')).toBeNull();
    // The anchor is the last child, so reading order is text-then-permalink.
    expect(container.querySelector('h2')?.lastElementChild).toBe(anchor);
  });

  it('omits the anchor when the heading has no id', () => {
    const { container } = render(<H2>No slug</H2>);

    expect(container.querySelector('a.heading-anchor')).toBeNull();
    expect(container.querySelector('h2')?.textContent).toBe('No slug');
  });

  it('forwards extra props onto the heading element', () => {
    const { container } = render(
      <H3 id="api" className="custom">
        API
      </H3>,
    );

    expect(container.querySelector('h3')?.className).toBe('custom');
  });
});
