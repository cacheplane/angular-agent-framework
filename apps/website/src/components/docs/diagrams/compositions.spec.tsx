// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { AgUiArchitecturePipeline } from './AgUiArchitecturePipeline';
import { A2uiMessageFlow } from './A2uiMessageFlow';
import { RenderHowItFits } from './RenderHowItFits';
import { RenderVsA2ui } from './RenderVsA2ui';

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

describe('A2uiMessageFlow', () => {
  it('mounts and names the parser and surface store stages', () => {
    const { container } = render(<A2uiMessageFlow />);
    expect(container.querySelector('svg[role="img"]')).not.toBeNull();
    const titles = Array.from(container.querySelectorAll('.tp-diagram-title')).map((t) => t.textContent);
    expect(titles).toContain('createA2uiMessageParser()');
    expect(titles).toContain('createA2uiSurfaceStore()');
  });

  it('accents only the a2ui-owned parser stage', () => {
    const { container } = render(<A2uiMessageFlow />);
    const accented = Array.from(container.querySelectorAll('g.tp-diagram-node[data-tone="accent"]'));
    expect(accented).toHaveLength(1);
    expect(accented[0]?.querySelector('.tp-diagram-eyebrow')?.textContent).toBe('@THREADPLANE/A2UI');
    expect(accented[0]?.querySelector('.tp-diagram-title')?.textContent).toBe('createA2uiMessageParser()');
  });
});

describe('RenderHowItFits', () => {
  it('mounts and shows the spec-to-components pipeline', () => {
    const { container } = render(<RenderHowItFits />);
    const titles = Array.from(container.querySelectorAll('.tp-diagram-title')).map((t) => t.textContent);
    expect(titles).toContain('@threadplane/render');
  });

  it('breaks each edge around its pill so the line does not show through the label', () => {
    const { container } = render(<RenderHowItFits />);
    expect(container.querySelectorAll('.tp-diagram-pill')).toHaveLength(2);
  });
});

describe('RenderVsA2ui', () => {
  it('mounts and shows both packages under chat', () => {
    const { container } = render(<RenderVsA2ui />);
    const titles = Array.from(container.querySelectorAll('.tp-diagram-title')).map((t) => t.textContent);
    expect(titles).toContain('@threadplane/render');
    expect(titles).toContain('@threadplane/a2ui');
    expect(titles).toContain('@threadplane/chat');
  });

  it('accents exactly the two surface nodes and wires at least three edges', () => {
    const { container } = render(<RenderVsA2ui />);
    const accented = container.querySelectorAll('g.tp-diagram-node[data-tone="accent"]');
    expect(accented).toHaveLength(2);
    const edges = container.querySelectorAll('path.tp-diagram-edge');
    expect(edges.length).toBeGreaterThanOrEqual(3);
  });
});
