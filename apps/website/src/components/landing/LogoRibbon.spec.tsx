// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LogoRibbon, COMPAT_GROUPS } from './LogoRibbon';

describe('LogoRibbon (compatibility boundary)', () => {
  it('renders three labelled groups in order', () => {
    render(<LogoRibbon />);
    expect(COMPAT_GROUPS.map((g) => g.label)).toEqual([
      'Direct Threadplane adapters',
      'Backends reachable through AG-UI',
      'Model providers, behind your backend',
    ]);
    for (const group of COMPAT_GROUPS) {
      expect(screen.getByText(group.label)).toBeTruthy();
      for (const item of group.items) expect(screen.getByText(item.name)).toBeTruthy();
    }
  });

  it('direct adapters are exactly LangGraph and AG-UI', () => {
    expect(COMPAT_GROUPS[0].items.map((i) => i.name)).toEqual(['LangGraph', 'AG-UI']);
  });

  it('is a labelled landmark, logos hidden from assistive tech, no customer wording', () => {
    const { container } = render(<LogoRibbon />);
    expect(container.querySelector('section')?.getAttribute('aria-label')).toBe(
      'Keep your agent stack. Standardize the Angular surface.',
    );
    for (const img of Array.from(container.querySelectorAll('img'))) {
      expect(img.getAttribute('aria-hidden')).toBe('true');
      expect(img.getAttribute('alt')).toBe('');
    }
    expect(container.textContent).not.toMatch(/trusted by|customers/i);
  });
});
