import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { cockpitManifest } from '@ngaf/cockpit-registry';
import { buildNavigationTree } from '../lib/route-resolution';
import { MobileNavOverlay } from './mobile-nav-overlay';

const tree = buildNavigationTree(cockpitManifest);
const entry = cockpitManifest.find(
  (e) =>
    e.product === 'render' &&
    e.section === 'core-capabilities' &&
    e.topic === 'spec-rendering' &&
    e.language === 'python'
)!;

describe('MobileNavOverlay', () => {
  it('renders nothing when closed', () => {
    const html = renderToStaticMarkup(
      <MobileNavOverlay
        navigationTree={tree}
        manifest={cockpitManifest}
        entry={entry}
        isOpen={false}
        onClose={() => {}}
      />
    );
    expect(html).toBe('');
  });

  it('renders all four product groups when open', () => {
    const html = renderToStaticMarkup(
      <MobileNavOverlay
        navigationTree={tree}
        manifest={cockpitManifest}
        entry={entry}
        isOpen={true}
        onClose={() => {}}
      />
    );
    expect(html).toContain('LangGraph');
    expect(html).toContain('Render');
    expect(html).toContain('Chat');
    expect(html).toContain('Deep Agents');
  });

  it('renders topic chips as links', () => {
    const html = renderToStaticMarkup(
      <MobileNavOverlay
        navigationTree={tree}
        manifest={cockpitManifest}
        entry={entry}
        isOpen={true}
        onClose={() => {}}
      />
    );
    expect(html).toContain('Streaming');
    expect(html).toContain('Persistence');
    expect(html).toContain('Messages');
    expect(html).toContain('href="/');
  });

  it('highlights the active entry chip', () => {
    const html = renderToStaticMarkup(
      <MobileNavOverlay
        navigationTree={tree}
        manifest={cockpitManifest}
        entry={entry}
        isOpen={true}
        onClose={() => {}}
      />
    );
    expect(html).toContain('aria-current="page"');
  });

  it('strips product prefix from topic titles', () => {
    const html = renderToStaticMarkup(
      <MobileNavOverlay
        navigationTree={tree}
        manifest={cockpitManifest}
        entry={entry}
        isOpen={true}
        onClose={() => {}}
      />
    );
    expect(html).toContain('Spec Rendering');
    expect(html).not.toContain('>Render Spec Rendering<');
  });

  it('filters out overview topics', () => {
    const html = renderToStaticMarkup(
      <MobileNavOverlay
        navigationTree={tree}
        manifest={cockpitManifest}
        entry={entry}
        isOpen={true}
        onClose={() => {}}
      />
    );
    // No chip should link to an overview topic (topic segment = "overview")
    const hrefMatches = html.match(/href="[^"]+"/g) || [];
    const overviewHrefs = hrefMatches.filter((h) => /\/overview\/overview\//.test(h));
    expect(overviewHrefs).toHaveLength(0);
  });

  it('includes the language picker', () => {
    const html = renderToStaticMarkup(
      <MobileNavOverlay
        navigationTree={tree}
        manifest={cockpitManifest}
        entry={entry}
        isOpen={true}
        onClose={() => {}}
      />
    );
    expect(html).toContain('Python');
  });

  it('includes a close button', () => {
    const html = renderToStaticMarkup(
      <MobileNavOverlay
        navigationTree={tree}
        manifest={cockpitManifest}
        entry={entry}
        isOpen={true}
        onClose={() => {}}
      />
    );
    expect(html).toContain('aria-label="Close navigation"');
  });
});
