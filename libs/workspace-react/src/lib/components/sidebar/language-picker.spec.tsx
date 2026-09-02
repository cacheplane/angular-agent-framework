import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cockpitManifest,
  type CockpitManifestEntry,
  type CockpitManifestIdentity,
} from '@threadplane/cockpit-registry';
import { LanguagePicker } from './language-picker';
import type { WorkspaceHostServices } from '../../workspace-contracts';

describe('LanguagePicker', () => {
  afterEach(() => {
    globalThis.document?.body.replaceChildren();
  });

  it('shows the current language in the trigger and opens a custom menu', () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    const { window } = dom;

    globalThis.window = window as unknown as Window & typeof globalThis;
    globalThis.document = window.document;
    globalThis.HTMLElement = window.HTMLElement;
    globalThis.Node = window.Node;
    globalThis.MouseEvent = window.MouseEvent;

    const baseEntry = cockpitManifest.find(
      (candidate) =>
        candidate.product === 'langgraph' &&
        candidate.section === 'core-capabilities' &&
        candidate.topic === 'streaming' &&
        candidate.language === 'python'
    )!;
    const identities: Record<'python' | 'typescript', CockpitManifestIdentity> = {
      python: {
        product: baseEntry.product,
        section: baseEntry.section,
        topic: baseEntry.topic,
        page: baseEntry.page,
        language: 'python',
      },
      typescript: {
        product: baseEntry.product,
        section: baseEntry.section,
        topic: baseEntry.topic,
        page: baseEntry.page,
        language: 'typescript',
      },
    };
    const entry: CockpitManifestEntry = {
      ...baseEntry,
      supportedLanguages: ['python', 'typescript'],
      equivalentPages: identities,
    };
    const typescriptEntry: CockpitManifestEntry = {
      ...entry,
      ...identities.typescript,
      id: `${entry.id}:typescript`,
    };
    const manifest = [entry, typescriptEntry];

    const container = document.createElement('div');
    document.body.appendChild(container);

    const root = createRoot(container);
    const hostServices: WorkspaceHostServices = {
      resolveEntryHref: (resolvedEntry) =>
        `/workspace/language/${resolvedEntry.language}`,
      navigate: vi.fn(),
    };

    act(() => {
      root.render(
        <LanguagePicker
          entry={entry}
          manifest={manifest}
          hostServices={hostServices}
        />
      );
    });

    expect(container.querySelector('select')).toBeNull();
    expect(container.textContent).toContain('Python');

    const trigger = container.querySelector('button');
    expect(trigger).not.toBeNull();

    act(() => {
      trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.querySelector('[role="menu"]')).not.toBeNull();
    expect(container.textContent).toContain('TypeScript');
    const typescriptLink = Array.from(
      container.querySelectorAll<HTMLAnchorElement>('[role="menuitem"]')
    ).find((link) => link.textContent === 'TypeScript');
    expect(typescriptLink?.getAttribute('href')).toBe(
      '/workspace/language/typescript'
    );

    act(() => {
      typescriptLink?.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      );
    });
    expect(hostServices.navigate).toHaveBeenCalledWith({
      path: '/workspace/language/typescript',
      restoreFocus: 'workspace-panel',
    });

    act(() => {
      root.unmount();
    });
  });
});
