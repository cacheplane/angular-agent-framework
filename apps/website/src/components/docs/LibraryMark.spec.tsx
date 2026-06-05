// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { LibraryMark } from './LibraryMark';

describe('LibraryMark', () => {
  it('renders a logo image for a logo-backed library', () => {
    const { container } = render(<LibraryMark library="langgraph" />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('/logos/langgraph.svg');
    expect(img?.getAttribute('alt')).toBe('');
  });

  it('renders an inline glyph (svg, no img) for an in-house library', () => {
    const { container } = render(<LibraryMark library="chat" />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('maps ag-ui and a2ui to their vendor logos', () => {
    const { container: a } = render(<LibraryMark library="ag-ui" />);
    expect(a.querySelector('img')?.getAttribute('src')).toBe('/logos/runtimes/copilotkit.svg');
    const { container: b } = render(<LibraryMark library="a2ui" />);
    expect(b.querySelector('img')?.getAttribute('src')).toBe('/logos/providers/google.svg');
  });
});
