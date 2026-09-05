// apps/website/src/components/landing/ScopeTable.spec.tsx
// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ScopeTable } from './ScopeTable';
import { FINAL_MILE_ASIDE, FINAL_MILE_HEADING } from '../../lib/positioning';

describe('ScopeTable as the final-mile section', () => {
  it('leads with the last-mile line and keeps the table and its anchor', () => {
    const { container } = render(<ScopeTable />);
    expect(screen.getByRole('heading', { name: FINAL_MILE_HEADING }).id).toBe('why-heading');
    expect(screen.getByText(FINAL_MILE_ASIDE)).toBeTruthy();
    expect(screen.getByText('The final mile')).toBeTruthy();
    expect(container.querySelector('[data-ui="section"]')?.getAttribute('id')).toBe('why');
    expect(screen.getAllByRole('row')).toHaveLength(5);
  });
});
