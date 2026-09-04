// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LogoRibbon, RIBBON_ITEMS, RIBBON_MORE_COUNT } from './LogoRibbon';

describe('LogoRibbon', () => {
  it('renders eight named items and the more-count', () => {
    render(<LogoRibbon />);
    expect(RIBBON_ITEMS).toHaveLength(8);
    for (const item of RIBBON_ITEMS) {
      expect(screen.getByText(item.name)).toBeTruthy();
    }
    expect(screen.getByText(`+ ${RIBBON_MORE_COUNT} more`)).toBeTruthy();
  });

  it('is a labelled landmark with no links', () => {
    const { container } = render(<LogoRibbon />);
    const section = container.querySelector('section');
    expect(section?.getAttribute('aria-label')).toBe('Works with your agent stack');
    expect(container.querySelectorAll('a')).toHaveLength(0);
  });

  it('reads as compatibility, not customers: hidden logos, visible names, no endorsement wording', () => {
    const { container } = render(<LogoRibbon />);
    expect(screen.getByText('Works with')).toBeTruthy();
    const imgs = Array.from(container.querySelectorAll('img'));
    expect(imgs).toHaveLength(RIBBON_ITEMS.length);
    for (const img of imgs) {
      expect(img.getAttribute('aria-hidden')).toBe('true');
      expect(img.getAttribute('alt')).toBe('');
    }
    expect(container.textContent).not.toMatch(/trusted by|customers|our clients|powered by/i);
  });
});
