import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Compatibility } from './Compatibility';
import { GATES_A, GATES_B, PROVIDERS } from '../../lib/airport-diagram';

describe('Compatibility', () => {
  it('renders the signal surface with the ids the homepage spine depends on', () => {
    // e2e/website.spec.ts asserts homepage order by heading id. Renaming
    // either of these turns that spec red for a reason nobody will guess.
    const { container } = render(<Compatibility />);
    const section = container.querySelector('[data-ui="section"]');
    expect(section?.getAttribute('data-surface')).toBe('signal');
    expect(section?.getAttribute('id')).toBe('compatibility');
    expect(section?.getAttribute('aria-labelledby')).toBe('compatibility-heading');
    expect(container.querySelector('#compatibility-heading')?.textContent).toBe(
      'Every stack has a gate.',
    );
  });

  it('names every gate and every provider in text, not only as a picture', () => {
    // The marks are decorative, so the accessible content is these names. If
    // the SVG were the only carrier the section would be empty to a reader.
    render(<Compatibility />);
    for (const g of [...GATES_A, ...GATES_B]) {
      expect(screen.getAllByText(g.name).length).toBeGreaterThan(0);
    }
    for (const p of PROVIDERS) {
      expect(screen.getAllByText(p.name).length).toBeGreaterThan(0);
    }
  });

  it('shows both adapters as the two concourses', () => {
    render(<Compatibility />);
    expect(screen.getAllByText('@threadplane/langgraph').length).toBeGreaterThan(0);
    expect(screen.getAllByText('@threadplane/ag-ui').length).toBeGreaterThan(0);
  });

  it('marks every logo decorative, since the visible name carries the meaning', () => {
    const { container } = render(<Compatibility />);
    const marks = container.querySelectorAll('image, img.airport-mark');
    expect(marks.length).toBeGreaterThan(0);
    for (const m of Array.from(marks)) {
      expect(m.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('states compatibility in words and never implies a customer', () => {
    const { container } = render(<Compatibility />);
    expect(screen.getByText(/Compatibility, not endorsement/)).toBeTruthy();
    expect(container.textContent).not.toMatch(/trusted by|customers|our clients|powered by/i);
  });

  it('says Threadplane never talks to model providers, not that it never sees them', () => {
    // never-SEES is a data claim the docs do not support; never-TALKS-TO is
    // structural. This is the same failure mode #1067 had to correct.
    const { container } = render(<Compatibility />);
    expect(container.textContent).toMatch(/never talks to them/i);
    expect(container.textContent).not.toMatch(/never sees/i);
  });

  it('links to the adapter guide', () => {
    render(<Compatibility />);
    expect(
      screen.getByRole('link', { name: 'Choose an adapter →' }).getAttribute('href'),
    ).toBe('/docs/choosing-an-adapter');
  });
});
