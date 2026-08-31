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
});
