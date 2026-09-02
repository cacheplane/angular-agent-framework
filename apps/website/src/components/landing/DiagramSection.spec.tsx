// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { DiagramSection } from './DiagramSection';

describe('DiagramSection', () => {
  it('renders heading, body, and its diagram child', () => {
    const { container, getByText } = render(
      <DiagramSection id="j" eyebrow="Journey" headline="The headline" body="The body.">
        <figure className="tp-diagram-figure" data-scale="marketing" />
      </DiagramSection>
    );
    expect(getByText('The headline').tagName).toBe('H2');
    expect(container.querySelector('section')?.getAttribute('aria-labelledby')).toBe('j-heading');
    expect(container.querySelector('figure.tp-diagram-figure')).not.toBeNull();
    expect(getByText('The body.').className).toContain('stack-diagram-body');
    expect(getByText('Journey')).toBeTruthy();
  });
});
