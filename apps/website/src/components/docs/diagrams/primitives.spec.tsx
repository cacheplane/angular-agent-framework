// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { DiagramFrame } from './DiagramFrame';
import { DiagramNode } from './DiagramNode';
import { DiagramEdge } from './DiagramEdge';
import { DiagramPill } from './DiagramPill';

describe('diagram kit primitives', () => {
  it('DiagramFrame renders a labeled svg with dot ground, arrow marker, and caption', () => {
    const { container, getByText } = render(
      <DiagramFrame slug="t" viewWidth={640} viewHeight={200} label="test diagram" caption="a caption">
        <DiagramEdge d="M10 10 H100" slug="t" arrow />
      </DiagramFrame>
    );
    const svg = container.querySelector('svg.tp-diagram-svg');
    expect(svg?.getAttribute('viewBox')).toBe('0 0 640 200');
    expect(svg?.getAttribute('aria-label')).toBe('test diagram');
    expect(container.querySelector('pattern#t-dots')).not.toBeNull();
    expect(container.querySelector('marker#t-arrow')).not.toBeNull();
    expect(container.querySelector('path.tp-diagram-edge')?.getAttribute('marker-end')).toBe('url(#t-arrow)');
    expect(getByText('a caption').tagName).toBe('FIGCAPTION');
  });

  it('DiagramFrame passes the marketing scale through as a data attribute', () => {
    const { container } = render(
      <DiagramFrame slug="m" viewWidth={640} viewHeight={200} label="x" scale="marketing">
        <g />
      </DiagramFrame>
    );
    expect(container.querySelector('figure')?.getAttribute('data-scale')).toBe('marketing');
  });

  it('DiagramFrame defaults data-scale to docs', () => {
    const { container } = render(
      <DiagramFrame slug="d" viewWidth={640} viewHeight={200} label="x">
        <g />
      </DiagramFrame>
    );
    expect(container.querySelector('figure')?.getAttribute('data-scale')).toBe('docs');
  });

  it('DiagramEdge omits marker-end when arrow is not set', () => {
    const { container } = render(
      <svg>
        <DiagramEdge d="M0 0 H10" />
      </svg>
    );
    expect(container.querySelector('path.tp-diagram-edge')?.getAttribute('marker-end')).toBeNull();
  });

  it('DiagramNode renders eyebrow, title, meta and tone', () => {
    const { container } = render(
      <svg>
        <DiagramNode x={0} y={0} w={200} h={64} eyebrow="Adapter" title="@threadplane/ag-ui" meta="toAgent()" tone="accent" />
      </svg>
    );
    const g = container.querySelector('g.tp-diagram-node');
    expect(g?.getAttribute('data-tone')).toBe('accent');
    expect(g?.querySelector('.tp-diagram-eyebrow')?.textContent).toBe('ADAPTER');
    expect(g?.querySelector('.tp-diagram-title')?.textContent).toBe('@threadplane/ag-ui');
    expect(g?.querySelector('.tp-diagram-meta')?.textContent).toBe('toAgent()');
  });

  it('DiagramNode centers a title-only node when align is middle', () => {
    const { container } = render(
      <svg>
        <DiagramNode x={0} y={0} w={200} h={40} title="LangGraph Platform" align="middle" titleStyle="sans" tone="dim" />
      </svg>
    );
    const title = container.querySelector('.tp-diagram-title');
    expect(title?.getAttribute('text-anchor')).toBe('middle');
    expect(title?.getAttribute('x')).toBe('100');
    expect(container.querySelector('g.tp-diagram-node')?.getAttribute('data-title')).toBe('sans');
  });

  it('DiagramFrame accepts the compact scale', () => {
    const { container } = render(
      <DiagramFrame slug="c" viewWidth={320} viewHeight={150} label="x" scale="compact">
        <g />
      </DiagramFrame>
    );
    expect(container.querySelector('figure')?.getAttribute('data-scale')).toBe('compact');
  });

  it('DiagramNode renders a mono meta when metaStyle is mono', () => {
    const { container } = render(
      <svg>
        <DiagramNode x={0} y={0} w={200} h={64} title="spec" meta='{ "component": "Form" }' metaStyle="mono" />
      </svg>
    );
    expect(container.querySelector('g.tp-diagram-node')?.getAttribute('data-meta')).toBe('mono');
  });

  it('DiagramPill renders a centered label', () => {
    const { container } = render(
      <svg>
        <DiagramPill cx={100} cy={50} w={120} label="SSE" />
      </svg>
    );
    const text = container.querySelector('.tp-diagram-pill text');
    expect(text?.textContent).toBe('SSE');
    expect(text?.getAttribute('text-anchor')).toBe('middle');
  });
});
