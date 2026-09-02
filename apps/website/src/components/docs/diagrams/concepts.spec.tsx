// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { StreamConcept } from './StreamConcept';
import { RenderConcept } from './RenderConcept';
import { ApproveConcept } from './ApproveConcept';
import { ShipConcept } from './ShipConcept';

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

  it('accents the UI-updates-itself payoff node, not the signals source', () => {
    const { container } = render(<StreamConcept />);
    const accentNodes = container.querySelectorAll('g.tp-diagram-node[data-tone="accent"]');
    expect(accentNodes.length).toBe(1);
    expect(accentNodes[0].querySelector('.tp-diagram-title')?.textContent).toBe('UI updates itself');
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

describe('ApproveConcept', () => {
  it('mounts compact with the interrupt/resume loop', () => {
    const { container } = render(<ApproveConcept />);
    const svg = container.querySelector('svg');
    expect(container.querySelector('figure')?.getAttribute('data-scale')).toBe('compact');
    expect(svg?.getAttribute('aria-label')).toBeTruthy();
    const titles = Array.from(container.querySelectorAll('.tp-diagram-title')).map((t) => t.textContent);
    expect(titles).toContain('Agent');
    expect(titles).toContain('Human');
    expect(titles).toContain('Resumes with the decision');
    const pills = Array.from(container.querySelectorAll('.tp-diagram-pill text')).map((t) => t.textContent);
    expect(pills).toContain('interrupt');
    expect(pills).toContain('resume');
    const accentNodes = container.querySelectorAll('g.tp-diagram-node[data-tone="accent"]');
    expect(accentNodes.length).toBe(1);
    expect(accentNodes[0].querySelector('.tp-diagram-title')?.textContent).toBe('Human');
    const pillGroups = container.querySelectorAll('.tp-diagram-pill');
    expect(pillGroups.length).toBeGreaterThan(0);
    pillGroups.forEach((pill) => {
      expect(pill.getAttribute('data-tone')).toBe('neutral');
    });
  });
});

describe('ShipConcept', () => {
  it('mounts compact with the thread crossing reload and deploy', () => {
    const { container } = render(<ShipConcept />);
    const svg = container.querySelector('svg');
    expect(container.querySelector('figure')?.getAttribute('data-scale')).toBe('compact');
    expect(svg?.getAttribute('aria-label')).toBeTruthy();
    const titles = Array.from(container.querySelectorAll('.tp-diagram-title')).map((t) => t.textContent);
    expect(titles).toContain('Starts');
    expect(titles).toContain('Resumes');
    const pills = Array.from(container.querySelectorAll('.tp-diagram-pill text')).map((t) => t.textContent);
    expect(pills).toContain('reload');
    expect(pills).toContain('deploy');
    const accentNodes = container.querySelectorAll('g.tp-diagram-node[data-tone="accent"]');
    expect(accentNodes.length).toBe(1);
    expect(accentNodes[0].querySelector('.tp-diagram-title')?.textContent).toBe('Resumes');
    const pillGroups = container.querySelectorAll('.tp-diagram-pill');
    expect(pillGroups.length).toBeGreaterThan(0);
    pillGroups.forEach((pill) => {
      expect(pill.getAttribute('data-tone')).toBe('neutral');
    });
  });
});
