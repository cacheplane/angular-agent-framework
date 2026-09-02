// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Callout } from './Callout';

describe('Callout', () => {
  it('renders a header band with the given title and tone', () => {
    const { container } = render(
      <Callout type="warning" title="Heads up">body text</Callout>
    );
    const root = container.querySelector('[data-mdx="callout"]');
    expect(root?.getAttribute('data-tone')).toBe('warning');
    const band = container.querySelector('.mdx-callout-band');
    expect(band?.textContent).toContain('Heads up');
    expect(band?.querySelector('svg')).not.toBeNull();
    expect(band?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('prefixes a screen-reader kind label when a title is given', () => {
    const { container } = render(<Callout type="warning" title="Heads up">body</Callout>);
    const sr = container.querySelector('.mdx-callout-title .sr-only');
    expect(sr?.textContent).toBe('Warning: ');
  });

  it.each([
    ['info', 'Note'],
    ['tip', 'Tip'],
    ['warning', 'Warning'],
    ['danger', 'Danger'],
  ] as const)('falls back to the kind label for %s when title is omitted', (type, label) => {
    const { container } = render(<Callout type={type}>body</Callout>);
    expect(container.querySelector('.mdx-callout-title')?.textContent).toBe(label);
  });

  it('defaults to info and renders children in the body', () => {
    const { container } = render(<Callout>the body</Callout>);
    expect(container.querySelector('[data-mdx="callout"]')?.getAttribute('data-tone')).toBe('info');
    expect(container.querySelector('.mdx-callout-body')?.textContent).toBe('the body');
  });
});
