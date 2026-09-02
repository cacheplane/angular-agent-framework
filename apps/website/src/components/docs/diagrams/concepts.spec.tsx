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
    expect(container.querySelector('figure')?.getAttribute('data-scale')).toBe('compact');
    const titles = Array.from(container.querySelectorAll('.tp-diagram-title')).map((t) => t.textContent);
    expect(titles).toContain('injectAgent()');
  });
});

describe('RenderConcept', () => {
  it('mounts compact and accents the your-components claim', () => {
    const { container } = render(<RenderConcept />);
    expect(container.querySelector('figure')?.getAttribute('data-scale')).toBe('compact');
    expect(container.querySelectorAll('g.tp-diagram-node[data-tone="accent"]').length).toBeGreaterThan(0);
  });
});
