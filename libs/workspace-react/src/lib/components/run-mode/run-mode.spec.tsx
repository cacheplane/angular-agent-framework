// SPDX-License-Identifier: MIT
/** @vitest-environment jsdom */
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RuntimePhase } from '../../runtime/runtime-state';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { RunMode } from './run-mode';

describe('RunMode', () => {
  let container: HTMLDivElement | undefined;
  let root: ReturnType<typeof createRoot> | undefined;

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    requiredProps.onFrameLoad.mockClear();
  });

  const requiredProps = {
    frameGeneration: 0,
    frameRef: React.createRef<HTMLIFrameElement>(),
    onFrameLoad: vi.fn(),
    runtimePhase: 'connecting' as RuntimePhase,
    getSessionId: () => 'cockpit_test-uuid',
  };

  it('renders a deterministic non-frame placeholder during SSR', () => {
    const html = renderToStaticMarkup(
      <RunMode
        entryTitle="LangGraph Streaming"
        runtimeUrl="http://localhost:4300"
        capabilitySlug="streaming"
        {...requiredProps}
      />,
    );
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('about:blank');
    expect(html).toContain('aria-label="Preparing runtime"');
    expect(requiredProps.onFrameLoad).not.toHaveBeenCalled();
  });

  it('renders a minimal empty state when runtimeUrl is null', () => {
    const html = renderToStaticMarkup(
      <RunMode
        entryTitle="LangGraph Streaming"
        runtimeUrl={null}
        capabilitySlug="streaming"
        {...requiredProps}
        runtimePhase="not_configured"
      />,
    );
    expect(html).not.toContain('<iframe');
    expect(html).toContain('No runtime available');
  });

  it('renders a truthful invalid-configuration state without parsing or mounting it', () => {
    const html = renderToStaticMarkup(
      <RunMode
        entryTitle="LangGraph Streaming"
        runtimeUrl={'javascript:alert(1)' as never}
        capabilitySlug="streaming"
        {...requiredProps}
        runtimePhase="invalid_configuration"
      />,
    );
    expect(html).not.toContain('<iframe');
    expect(html).toContain('Invalid runtime URL');
  });

  it('iframe src includes cockpit_did and cockpit_cap query params', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root!.render(
        <RunMode
          entryTitle="Streaming"
          runtimeUrl="http://localhost:4500/path"
          capabilitySlug="streaming"
          {...requiredProps}
        />,
      );
    });

    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    expect(iframe).not.toBeNull();
    const src = new URL(iframe.src);
    expect(src.searchParams.get('cockpit_did')).toBe('cockpit_test-uuid');
    expect(src.searchParams.get('cockpit_cap')).toBe('streaming');
    expect(iframe.getAttribute('referrerpolicy')).toBe('origin');
    expect(iframe.getAttribute('allow')).toBe('clipboard-write');
    expect(requiredProps.frameRef.current).toBe(iframe);

    act(() => iframe.dispatchEvent(new Event('load')));
    expect(requiredProps.onFrameLoad).toHaveBeenCalledTimes(1);
  });

  it('remounts the frame for a new generation', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root!.render(
        <RunMode
          entryTitle="Streaming"
          runtimeUrl="http://localhost:4500/path"
          capabilitySlug="streaming"
          {...requiredProps}
        />,
      );
    });
    const firstFrame = container.querySelector('iframe');

    act(() => {
      root!.render(
        <RunMode
          entryTitle="Streaming"
          runtimeUrl="http://localhost:4500/path"
          capabilitySlug="streaming"
          {...requiredProps}
          frameGeneration={1}
        />,
      );
    });

    expect(container.querySelector('iframe')).not.toBe(firstFrame);
  });

  it('does not retain the old frame when the validated route identity changes', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root!.render(
        <RunMode
          entryTitle="Streaming"
          runtimeUrl="https://old.runtime.test/path"
          capabilitySlug="streaming"
          {...requiredProps}
        />,
      );
    });
    const oldFrame = container.querySelector('iframe');

    act(() => {
      root!.render(
        <RunMode
          entryTitle="Persistence"
          runtimeUrl="https://new.runtime.test/path"
          capabilitySlug="persistence"
          {...requiredProps}
        />,
      );
    });
    const newFrame = container.querySelector('iframe');

    expect(newFrame).not.toBe(oldFrame);
    expect(new URL(newFrame!.getAttribute('src')!).origin).toBe(
      'https://new.runtime.test',
    );
    act(() => oldFrame!.dispatchEvent(new Event('load')));
    expect(requiredProps.onFrameLoad).not.toHaveBeenCalled();
  });
});
