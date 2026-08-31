// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  WEBSITE_ANGULAR_SUPPORT_ROWS,
  WEBSITE_SUPPORTED_ANGULAR_MAJORS,
} from './angular-support.mjs';
import { CompatibilityMatrix } from './CompatibilityMatrix';

describe('CompatibilityMatrix', () => {
  it('renders the structured Angular support buckets', () => {
    render(<CompatibilityMatrix />);
    expect(WEBSITE_SUPPORTED_ANGULAR_MAJORS).toEqual([20, 21, 22]);

    expect(screen.getByRole('rowheader', { name: 'Supported' })).toBeTruthy();
    expect(screen.getByText('Angular 20, 21, 22')).toBeTruthy();
    expect(screen.getByText(/Experimental/)).toBeTruthy();
    expect(screen.getByRole('rowheader', { name: 'Planned' })).toBeTruthy();
    expect(screen.getAllByText('—')).toHaveLength(2);
    expect(
      WEBSITE_ANGULAR_SUPPORT_ROWS.some(
        (row) => row.label === 'Planned' && /Angular 22/.test(row.versions)
      )
    ).toBe(false);
    expect(screen.getByText(/Unsupported/)).toBeTruthy();
    expect(screen.getByText(/≤19/)).toBeTruthy();
  });

  it('uses semantic column and row headers', () => {
    render(<CompatibilityMatrix />);
    expect(
      screen.getByRole('columnheader', { name: 'Status' }).getAttribute('scope')
    ).toBe('col');
    expect(
      screen
        .getByRole('columnheader', { name: 'Angular versions' })
        .getAttribute('scope')
    ).toBe('col');
    expect(
      screen.getByRole('rowheader', { name: 'Supported' }).getAttribute('scope')
    ).toBe('row');
  });
});
