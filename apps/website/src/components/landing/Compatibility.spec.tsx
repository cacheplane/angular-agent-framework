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
      expect(list.getAllByText(g.long ?? g.name).length).toBeGreaterThan(0);
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

  it('spells out in the list the name the stand had to abbreviate', () => {
    // `MS AGENT FWK` exists because a 38px stand has room for nothing longer.
    // The list has room, and it is what a screen reader hears, so the two
    // surfaces get different strings on purpose — which is the whole reason
    // `Gate.long` exists and the only thing that keeps it from rotting.
    const { container } = render(<Compatibility />);
    const stack = container.querySelector('.airport-stack');
    expect(stack, 'the accessible stack is gone').toBeTruthy();
    const abbreviated = [...GATES_A, ...GATES_B].filter((g) => g.long);
    expect(abbreviated.length, 'no gate carries a long form any more').toBeGreaterThan(0);
    for (const g of abbreviated) {
      const list = within(stack as HTMLElement);
      expect(list.getAllByText(g.long as string).length).toBeGreaterThan(0);
      expect(list.queryByText(g.name), `the stack still shows "${g.name}"`).toBeNull();
      // ...and the plate still draws the short one, or the abbreviation was
      // simply a bug rather than a constraint.
      expect(container.querySelector(`[data-stand="${g.gate}"]`)?.textContent).toContain(g.name);
    }
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

  it('keeps the whole plate out of the accessibility tree', () => {
    // role="presentation" does NOT inherit to descendants, so the plate's own
    // <text> — runway ids, taxiway letters, "2000 FT" — leaked to screen
    // readers as unnamed chart noise. aria-hidden takes the subtree with it,
    // which is what leaves .airport-stack as the band's accessible content.
    const { container } = render(<Compatibility />);
    const plate = container.querySelector('[data-diagram="airport"]');
    expect(plate?.getAttribute('aria-hidden')).toBe('true');
  });

  it('marks every logo decorative, since the visible name carries the meaning', () => {
    const { container } = render(<Compatibility />);
    const marks = container.querySelectorAll('image, img.airport-mark');
    expect(marks.length).toBeGreaterThan(0);
    for (const m of Array.from(marks)) {
      expect(m.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('never implies a customer, and no longer needs a disclaimer to say so', () => {
    // The "Compatibility, not endorsement" line was removed on request. The
    // claim it guarded against still matters, so the negative assertion stays:
    // nothing in the band may read as an endorsement in the first place.
    const { container } = render(<Compatibility />);
    expect(screen.queryByText(/Compatibility, not endorsement/)).toBeNull();
    expect(container.textContent).not.toMatch(/trusted by|customers|our clients|powered by/i);
  });

  it('never claims Threadplane cannot see model providers', () => {
    // The strip used to read "OFF AIRPORT - BEHIND YOUR BACKEND. THREADPLANE
    // NEVER TALKS TO THEM." and this guard held the positive half of that
    // claim in place. The label is now "All AI Models supported" on request,
    // so the structural never-TALKS-TO claim is off the homepage entirely.
    //
    // The negative half stays, and matters more: never-SEES is a data claim
    // the docs do not support, and it is the overclaim #1067 had to correct.
    // It must not appear anywhere in the band, drawn or spoken.
    const { container } = render(<Compatibility />);
    expect(container.querySelector('.airport-stack'), 'the accessible stack is gone').toBeTruthy();
    expect(container.textContent).not.toMatch(/never sees/i);
  });

  it('carries the adapter-guide CTA', () => {
    // By its stable hook, not its copy: the label and the href belong to
    // AdapterGuideLink and are asserted in AdapterGuideLink.spec.tsx. All this
    // band owns is that the link is here.
    const { container } = render(<Compatibility />);
    expect(container.querySelectorAll('[data-cta="home_adapter_guide"]').length).toBe(1);
  });

  it('ships a phone form driven by the same gate table as the plate', () => {
    // A seven-stand rotated airfield has no 390px form. The precedent is
    // .arch-stack: hide the figure below the breakpoint (1024px here, not the
    // usual 768px — see landing.css) and show an HTML list built from the same
    // data, never a sideways scroll.
    const { container } = render(<Compatibility />);
    expect(container.querySelector('.airport-figure')).toBeTruthy();
    const stack = container.querySelector('.airport-stack');
    expect(stack).toBeTruthy();
    const items = stack!.querySelectorAll('.airport-stack-gates li');
    expect(items).toHaveLength(GATES_A.length + GATES_B.length);
    expect(screen.getByRole('list', { name: /CONCOURSE A/ })).toBeTruthy();
    expect(screen.getByRole('list', { name: /CONCOURSE B/ })).toBeTruthy();
  });
});
