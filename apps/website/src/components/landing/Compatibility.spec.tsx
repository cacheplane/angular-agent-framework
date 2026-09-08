import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Compatibility, COMPATIBILITY_GROUPS } from './Compatibility';

describe('Compatibility', () => {
  it('renders a light section with a stable id', () => {
    const { container } = render(<Compatibility />);
    const section = container.querySelector('[data-ui="section"]');
    expect(section?.getAttribute('data-surface')).toBe('tinted');
    expect(section?.getAttribute('id')).toBe('compatibility');
  });

  it('lists twelve integrations across three groups', () => {
    render(<Compatibility />);
    // The suite otherwise iterates the same constant the component renders
    // from, so it cannot see content disappear: a reviewer deleted the whole
    // Protocols group — LangGraph and AG-UI, the two with first-party
    // adapters — and every other test stayed green.
    expect(COMPATIBILITY_GROUPS).toHaveLength(3);
    expect(COMPATIBILITY_GROUPS.map((g) => g.label)).toEqual([
      'Model providers',
      'Agent runtimes',
      'Protocols',
    ]);
    expect(COMPATIBILITY_GROUPS.flatMap((g) => g.items)).toHaveLength(12);
    for (const name of ['LangGraph', 'AG-UI', 'OpenAI', 'Anthropic']) {
      expect(screen.getByText(name)).toBeTruthy();
    }
  });

  it('groups every item under a labelled heading', () => {
    render(<Compatibility />);
    for (const group of COMPATIBILITY_GROUPS) {
      expect(screen.getByText(group.label)).toBeTruthy();
      for (const item of group.items) expect(screen.getByText(item.name)).toBeTruthy();
    }
    // The label is a bare <p>, so the list only carries an accessible name if
    // aria-labelledby actually points at it.
    for (const group of COMPATIBILITY_GROUPS) {
      expect(screen.getByRole('list', { name: group.label })).toBeTruthy();
    }
  });

  it('states compatibility in words and never implies a customer', () => {
    const { container } = render(<Compatibility />);
    // The claim used to exist only as alt="" plus a spec comment. A reader
    // could not see it. Now it is on the page.
    expect(screen.getByText(/Compatibility, not endorsement/)).toBeTruthy();
    expect(container.textContent).not.toMatch(/trusted by|customers|our clients|powered by/i);
  });

  it('marks every logo decorative, since the visible name carries the meaning', () => {
    const { container } = render(<Compatibility />);
    const logos = container.querySelectorAll('img.compatibility-logo');
    const withLogos = COMPATIBILITY_GROUPS.flatMap((g) => g.items).filter((i) => i.logoSrc);
    expect(logos).toHaveLength(withLogos.length);
    for (const img of Array.from(logos)) {
      expect(img.getAttribute('aria-hidden')).toBe('true');
      expect(img.getAttribute('alt')).toBe('');
    }
  });

  it('links to the adapter guide', () => {
    render(<Compatibility />);
    expect(
      screen.getByRole('link', { name: 'Choose an adapter →' }).getAttribute('href'),
    ).toBe('/docs/choosing-an-adapter');
  });
});
