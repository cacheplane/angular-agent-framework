// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { HomeConceptGrid } from './HomeConceptGrid';

describe('HomeConceptGrid', () => {
  it('renders four compact concept cards with anchor links in page order', () => {
    const { container } = render(<HomeConceptGrid />);
    expect(container.querySelectorAll('.home-concept-card')).toHaveLength(4);
    expect(container.querySelectorAll('figure[data-scale="compact"]')).toHaveLength(4);
    const hrefs = Array.from(container.querySelectorAll('a.home-concept-link')).map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['#stream', '#render', '#ship', '#approve']);
  });

  it('is a labeled section', () => {
    const { container } = render(<HomeConceptGrid />);
    expect(container.querySelector('section')?.getAttribute('aria-labelledby')).toBe('how-it-works-heading');
  });
});
