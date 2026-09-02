// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { StackDiagramSection } from './StackDiagramSection';

describe('StackDiagramSection', () => {
  it('renders heading, body, and a marketing-scaled stack diagram', () => {
    const { container, getByText } = render(
      <StackDiagramSection
        id="architecture"
        eyebrow="Architecture"
        headline="One contract between your UI and any runtime"
        body="The body copy."
        highlight="none"
      />
    );
    expect(getByText('One contract between your UI and any runtime').tagName).toBe('H2');
    expect(container.querySelector('section')?.getAttribute('aria-labelledby')).toBe('architecture-heading');
    expect(container.querySelector('figure.tp-diagram-figure')?.getAttribute('data-scale')).toBe('marketing');
  });

  it('accents the LangGraph node when highlight="langgraph"', () => {
    const { container } = render(
      <StackDiagramSection
        id="architecture"
        eyebrow="Architecture"
        headline="One contract between your UI and any runtime"
        body="The body copy."
        highlight="langgraph"
      />
    );
    const titles = Array.from(container.querySelectorAll('.tp-diagram-title'));
    const langgraphTitle = titles.find((el) => el.textContent === '@threadplane/langgraph');
    expect(langgraphTitle?.closest('g.tp-diagram-node')?.getAttribute('data-tone')).toBe('accent');
  });
});
