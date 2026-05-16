// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CompatibilityMatrix } from './CompatibilityMatrix';

describe('CompatibilityMatrix', () => {
  it('renders four buckets with the conservative content', () => {
    render(<CompatibilityMatrix />);
    expect(screen.getByText(/Supported/)).toBeTruthy();
    expect(screen.getByText(/Angular 20, 21/)).toBeTruthy();
    expect(screen.getByText(/Experimental/)).toBeTruthy();
    expect(screen.getByText(/Planned/)).toBeTruthy();
    expect(screen.getByText(/Angular 22/)).toBeTruthy();
    expect(screen.getByText(/Unsupported/)).toBeTruthy();
    expect(screen.getByText(/≤19/)).toBeTruthy();
  });
});
