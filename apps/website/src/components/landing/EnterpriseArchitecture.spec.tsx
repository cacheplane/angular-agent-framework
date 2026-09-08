// @vitest-environment jsdom
import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  EnterpriseArchitecture,
  ARCHITECTURE_HEADLINE,
} from './EnterpriseArchitecture';
import {
  CARDS,
  COLUMNS,
  MODEL_STRIP,
  diagramHrefs,
} from '../../lib/architecture-diagram';

describe('EnterpriseArchitecture', () => {
  it('renders the section with its heading id, every column label, card, and link', () => {
    render(<EnterpriseArchitecture />);
    expect(document.querySelector('section#architecture')).not.toBeNull();
    expect(document.querySelector('#architecture-heading')?.textContent).toBe(
      ARCHITECTURE_HEADLINE
    );
    expect(document.querySelectorAll('[data-column]')).toHaveLength(
      COLUMNS.length
    );
    expect(document.querySelectorAll('[data-card]')).toHaveLength(CARDS.length);
    const hrefs = new Set(
      [...document.querySelectorAll('a[href]')].map((a) =>
        a.getAttribute('href')
      )
    );
    for (const href of diagramHrefs()) expect(hrefs.has(href), href).toBe(true);
  });

  it('highlights Threadplane and the first-class LangGraph lane, and nests no anchors', () => {
    render(<EnterpriseArchitecture />);
    expect(
      document.querySelector('[data-card="threadplane"] .arch-card--tp')
    ).not.toBeNull();
    expect(
      document.querySelector('[data-card="langgraph-sdk"] .arch-card--tp')
    ).not.toBeNull();
    expect(
      document.querySelector('[data-card="ag-ui"] .arch-card--tp')
    ).toBeNull();
    expect(document.querySelector('a a')).toBeNull();
    // The Threadplane card's title is the link; its capabilities are links of their own.
    expect(
      document.querySelector('[data-card="threadplane"] a.arch-title-link')
    ).not.toBeNull();
    expect(
      document.querySelectorAll('[data-card="threadplane"] a.arch-cap')
    ).toHaveLength(5);
  });

  it('draws every card rect at the data module coordinates and the model strip chips', () => {
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
    expect(
      document.querySelectorAll('[data-model-strip] [data-chip]')
    ).toHaveLength(MODEL_STRIP.chips.length);
  });

  it('shows the alignment grid only when asked', () => {
    render(<EnterpriseArchitecture />);
    expect(document.querySelector('[data-alignment-grid]')).toBeNull();
    document.body.innerHTML = '';
    render(<EnterpriseArchitecture grid />);
    expect(document.querySelector('[data-alignment-grid]')).not.toBeNull();
  });
});
