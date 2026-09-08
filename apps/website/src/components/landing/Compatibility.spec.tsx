import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Compatibility } from './Compatibility';
import { CONCOURSES, GATES_A, GATES_B, PROVIDERS } from '../../lib/airport-diagram';

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

  it('names every gate and every provider in the HTML stack, not only on the plate', () => {
    // The marks are decorative and the plate itself is aria-hidden, so this
    // list is the section's ONLY accessible content. Scoped to .airport-stack
    // on purpose: an unscoped getAllByText also matches the SVG's own <text>,
    // so deleting the whole stack would leave the gate half of this green
    // while a screen reader heard nothing.
    const { container } = render(<Compatibility />);
    const stack = container.querySelector('.airport-stack');
    expect(stack, 'the accessible stack is gone').toBeTruthy();
    const list = within(stack as HTMLElement);
    for (const g of [...GATES_A, ...GATES_B]) {
      expect(list.getAllByText(g.name).length).toBeGreaterThan(0);
    }
    for (const p of PROVIDERS) {
      expect(list.getAllByText(p.name).length).toBeGreaterThan(0);
    }
  });

  it('draws a stand for every gate and a concourse for every adapter', () => {
    // Without this the plate is untestable furniture: replace <Plate /> with
    // an empty <figure /> and every other test here still passes, because the
    // stack alone carries all the names.
    const { container } = render(<Compatibility />);
    expect(container.querySelectorAll('[data-diagram="airport"]').length).toBe(1);
    expect(container.querySelectorAll('[data-stand]').length).toBe(
      GATES_A.length + GATES_B.length,
    );
    expect(container.querySelectorAll('[data-concourse]').length).toBe(CONCOURSES.length);
  });

  it('shows both adapters as the two concourses', () => {
    // Read off the stack, for the reason above — the plate is aria-hidden, so
    // matching the package names there proves nothing about what is announced.
    // Each name is paired with its concourse: an adapter labelled with the
    // other one's package would otherwise pass.
    const { container } = render(<Compatibility />);
    const labels = Array.from(
      container.querySelectorAll('.airport-stack .airport-stack-label'),
    ).map((el) => el.textContent ?? '');
    for (const c of CONCOURSES) {
      expect(
        labels.some((t) => t.includes(c.label) && t.includes(c.pkg)),
        `${c.label} is not labelled ${c.pkg}`,
      ).toBe(true);
    }
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

  it('carries the adapter-guide CTA', () => {
    // By its stable hook, not its copy: the label and the href belong to
    // AdapterGuideLink and are asserted in AdapterGuideLink.spec.tsx. All this
    // band owns is that the link is here.
    const { container } = render(<Compatibility />);
    expect(container.querySelectorAll('[data-cta="home_adapter_guide"]').length).toBe(1);
  });
});
