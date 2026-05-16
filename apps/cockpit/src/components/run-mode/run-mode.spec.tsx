// SPDX-License-Identifier: MIT
/** @vitest-environment jsdom */
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/analytics/distinct-id', () => ({
  getCockpitSessionId: () => 'cockpit_test-uuid',
}));

import { RunMode } from './run-mode';

describe('RunMode', () => {
  let container: HTMLDivElement | undefined;
  let root: ReturnType<typeof createRoot> | undefined;

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
  });

  it('renders an iframe when runtimeUrl is provided', () => {
    const html = renderToStaticMarkup(
      <RunMode entryTitle="LangGraph Streaming" runtimeUrl="http://localhost:4300" capabilitySlug="streaming" />,
    );
    expect(html).toContain('<iframe');
    expect(html).toContain('allow="clipboard-write"');
  });

  it('renders a minimal empty state when runtimeUrl is null', () => {
    const html = renderToStaticMarkup(
      <RunMode entryTitle="LangGraph Streaming" runtimeUrl={null} capabilitySlug="streaming" />,
    );
    expect(html).not.toContain('<iframe');
    expect(html).toContain('No runtime available');
  });

  it('iframe src includes cockpit_did and cockpit_cap query params', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root!.render(
        <RunMode entryTitle="Streaming" runtimeUrl="http://localhost:4500" capabilitySlug="streaming" />,
      );
    });

    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    expect(iframe).not.toBeNull();
    const src = new URL(iframe.src);
    expect(src.searchParams.get('cockpit_did')).toBe('cockpit_test-uuid');
    expect(src.searchParams.get('cockpit_cap')).toBe('streaming');
  });
});
