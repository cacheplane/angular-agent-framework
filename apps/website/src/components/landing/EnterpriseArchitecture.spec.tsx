// @vitest-environment jsdom
import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  EnterpriseArchitecture,
  ARCHITECTURE_HEADLINE,
} from './EnterpriseArchitecture';
import { CARDS, ZONES, diagramHrefs } from '../../lib/architecture-diagram';

describe('EnterpriseArchitecture', () => {
  it('renders the section with its heading id, every zone and card, and a link per card', () => {
    render(<EnterpriseArchitecture />);
    const section = document.querySelector('section#architecture');
    expect(section).not.toBeNull();
    expect(document.querySelector('#architecture-heading')?.textContent).toBe(
      ARCHITECTURE_HEADLINE
    );
    expect(document.querySelectorAll('[data-zone]')).toHaveLength(ZONES.length);
    expect(document.querySelectorAll('[data-card]')).toHaveLength(CARDS.length);
    const hrefs = new Set(
      [...document.querySelectorAll('a[href]')].map((a) =>
        a.getAttribute('href')
      )
    );
    for (const href of diagramHrefs()) expect(hrefs.has(href), href).toBe(true);
  });

  it('marks the Threadplane card as the highlight and gives every other card a docs affordance', () => {
    render(<EnterpriseArchitecture />);
    expect(
      document.querySelector('[data-card="threadplane"] .arch-card--tp')
    ).not.toBeNull();
    const docs = [...document.querySelectorAll('.arch-docs')];
    expect(docs).toHaveLength(CARDS.filter((c) => c.docsLabel).length);
    expect(
      document.querySelector('[data-card="threadplane"] .arch-docs')
    ).toBeNull();
  });

  it('draws every card rect at the data module coordinates', () => {
    render(<EnterpriseArchitecture />);
    for (const c of CARDS) {
      const rect = document.querySelector(
        `[data-card="${c.id}"] rect.arch-card`
      );
      expect(rect?.getAttribute('x')).toBe(String(c.x));
      expect(rect?.getAttribute('y')).toBe(String(c.y));
      expect(rect?.getAttribute('width')).toBe(String(c.width));
      expect(rect?.getAttribute('height')).toBe(String(c.height));
    }
  });

  it('shows the alignment grid only when asked', () => {
    render(<EnterpriseArchitecture />);
    expect(document.querySelector('[data-alignment-grid]')).toBeNull();
    document.body.innerHTML = '';
    render(<EnterpriseArchitecture grid />);
    expect(document.querySelector('[data-alignment-grid]')).not.toBeNull();
    expect(
      document.querySelector('[data-diagram]')?.getAttribute('data-grid')
    ).toBe('true');
  });
});
