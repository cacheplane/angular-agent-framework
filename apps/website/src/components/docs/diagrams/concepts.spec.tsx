// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { StreamConcept } from './StreamConcept';
import { RenderConcept } from './RenderConcept';

/** Compact homepage concept cards: each must mount labeled, at compact scale,
 * and carry its load-bearing API/package names. */
describe('StreamConcept', () => {
  it('mounts compact with the signals claim', () => {
    const { container } = render(<StreamConcept />);
    const svg = container.querySelector('svg');
    expect(container.querySelector('figure')?.getAttribute('data-scale')).toBe('compact');
    expect(svg?.getAttribute('aria-label')).toBeTruthy();
    const titles = Array.from(container.querySelectorAll('.tp-diagram-title')).map((t) => t.textContent);
    expect(titles).toContain('injectAgent()');
  });
});

describe('RenderConcept', () => {
  it('accents the your-components payoff node', () => {
    const { container } = render(<RenderConcept />);
    expect(container.querySelector('figure')?.getAttribute('data-scale')).toBe('compact');
    const titles = Array.from(container.querySelectorAll('.tp-diagram-title')).map((t) => t.textContent);
    expect(titles).toContain("type: 'Text'");
    expect(titles).toContain('defineAngularRegistry()');
    const accentNodes = container.querySelectorAll('g.tp-diagram-node[data-tone="accent"]');
    expect(accentNodes.length).toBe(1);
    expect(accentNodes[0].querySelector('.tp-diagram-title')?.textContent).toBe('Your own Angular components');
  });
});
