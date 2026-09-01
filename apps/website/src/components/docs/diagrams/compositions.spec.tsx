// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { AgUiArchitecturePipeline } from './AgUiArchitecturePipeline';

/**
 * Compositions are hand-placed layouts; the spec guards that each mounts,
 * is labeled for screen readers, and names its load-bearing packages.
 * Later tasks append one describe block per composition.
 */
describe('AgUiArchitecturePipeline', () => {
  it('mounts with an accessible label and the pipeline stages', () => {
    const { container } = render(<AgUiArchitecturePipeline />);
    expect(container.querySelector('svg[role="img"]')?.getAttribute('aria-label')).toBeTruthy();
    const titles = Array.from(container.querySelectorAll('.tp-diagram-title')).map((t) => t.textContent);
    expect(titles).toContain('@threadplane/ag-ui');
    expect(titles).toContain('AbstractAgent');
  });
});
