// libs/chat/src/lib/styles/chat-tokens.spec.ts
// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { ROOT_TOKEN_STYLES } from './chat-tokens';

describe('ROOT_TOKEN_STYLES — prefers-reduced-motion', () => {
  it('includes a prefers-reduced-motion media block', () => {
    expect(ROOT_TOKEN_STYLES).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('applies a universal selector inside the media block', () => {
    expect(ROOT_TOKEN_STYLES).toMatch(/\*,\s*\*::before,\s*\*::after/);
  });

  it('collapses animation-duration to 0.01ms', () => {
    expect(ROOT_TOKEN_STYLES).toContain('animation-duration: 0.01ms');
  });

  it('collapses transition-duration to 0.01ms', () => {
    expect(ROOT_TOKEN_STYLES).toContain('transition-duration: 0.01ms');
  });

  it('caps animation-iteration-count to 1', () => {
    expect(ROOT_TOKEN_STYLES).toContain('animation-iteration-count: 1');
  });

  it('forces auto scroll-behavior', () => {
    expect(ROOT_TOKEN_STYLES).toContain('scroll-behavior: auto');
  });

  it.each([
    '.tcc__pill[data-status="running"] svg',
    '.tplane-chat-typing-dot',
    '.tplane-chat-caret',
    '.tplane-chat-welcome__pulse',
    '.chat-genui-skeleton',
    '.chat-debug__pill--active',
  ])('includes static-fallback override for %s', (selector) => {
    expect(ROOT_TOKEN_STYLES).toContain(selector);
  });
});

describe('ROOT_TOKEN_STYLES — edge-claim primitive', () => {
  it.each([
    '--tplane-chat-occupy-top:    0px;',
    '--tplane-chat-occupy-right:  0px;',
    '--tplane-chat-occupy-bottom: 0px;',
    '--tplane-chat-occupy-left:   0px;',
  ])('defines default %s on :root', (decl) => {
    expect(ROOT_TOKEN_STYLES).toContain(decl);
  });

  it.each([
    '--tplane-chat-debug-panel-size-h: 40vh;',
    '--tplane-chat-debug-panel-size-w: 420px;',
  ])('defines debug panel size token %s', (decl) => {
    expect(ROOT_TOKEN_STYLES).toContain(decl);
  });

  it('maps data-threadplane-chat-sidebar="open" to occupy-right', () => {
    expect(ROOT_TOKEN_STYLES).toMatch(
      /:root\[data-threadplane-chat-sidebar="open"\]\s*\{[^}]*--tplane-chat-occupy-right:\s*var\(--tplane-chat-sidebar-width-drawer/,
    );
  });

  it.each([
    ['bottom', '--tplane-chat-occupy-bottom', '--tplane-chat-debug-panel-size-h'],
    ['right',  '--tplane-chat-occupy-right',  '--tplane-chat-debug-panel-size-w'],
    ['left',   '--tplane-chat-occupy-left',   '--tplane-chat-debug-panel-size-w'],
  ])('maps data-threadplane-chat-debug=%s to %s via %s', (dock, occupyVar, sizeVar) => {
    const pattern = new RegExp(
      `:root\\[data-threadplane-chat-debug="${dock}"\\]\\s*\\{[^}]*${occupyVar}:\\s*var\\(${sizeVar}`,
    );
    expect(ROOT_TOKEN_STYLES).toMatch(pattern);
  });

  // ── per-component claim vars (peer-only reads) ────────────────────────
  // Components must NOT read their own aggregate claim (would feedback).
  // Each component publishes a per-component claim var that peers read.
  it.each([
    '--tplane-chat-sidebar-claim-right:  0px;',
    '--tplane-chat-debug-claim-top:      0px;',
    '--tplane-chat-debug-claim-right:    0px;',
    '--tplane-chat-debug-claim-bottom:   0px;',
    '--tplane-chat-debug-claim-left:     0px;',
  ])('defines per-component default %s', (decl) => {
    expect(ROOT_TOKEN_STYLES).toContain(decl);
  });

  it('sidebar attribute mapping also sets per-component claim var', () => {
    expect(ROOT_TOKEN_STYLES).toMatch(
      /:root\[data-threadplane-chat-sidebar="open"\]\s*\{[^}]*--tplane-chat-sidebar-claim-right:\s*var\(--tplane-chat-sidebar-width-drawer/,
    );
  });

  it.each([
    ['bottom', '--tplane-chat-debug-claim-bottom', '--tplane-chat-debug-panel-size-h'],
    ['right',  '--tplane-chat-debug-claim-right',  '--tplane-chat-debug-panel-size-w'],
    ['left',   '--tplane-chat-debug-claim-left',   '--tplane-chat-debug-panel-size-w'],
  ])('debug attribute mapping for %s also sets %s', (dock, claimVar, sizeVar) => {
    const pattern = new RegExp(
      `:root\\[data-threadplane-chat-debug="${dock}"\\]\\s*\\{[^}]*${claimVar}:\\s*var\\(${sizeVar}`,
    );
    expect(ROOT_TOKEN_STYLES).toMatch(pattern);
  });
});

describe('ROOT_TOKEN_STYLES — citation tokens', () => {
  it.each([
    '--tplane-chat-citation-accent:',
    '--tplane-chat-citation-accent-soft:',
    '--tplane-chat-citation-accent-border:',
    '--tplane-chat-citation-marker-bg:',
    '--tplane-chat-citation-marker-border:',
    '--tplane-chat-citation-marker-fg:',
    '--tplane-chat-citation-radius:',
    '--tplane-chat-citation-type-web-fg:',
    '--tplane-chat-citation-type-web-bg:',
    '--tplane-chat-citation-type-web-border:',
    '--tplane-chat-citation-type-file-fg:',
    '--tplane-chat-citation-type-file-bg:',
    '--tplane-chat-citation-type-file-border:',
    '--tplane-chat-citation-type-app-fg:',
    '--tplane-chat-citation-type-app-bg:',
    '--tplane-chat-citation-type-app-border:',
    '--tplane-chat-citation-type-memory-fg:',
    '--tplane-chat-citation-type-memory-bg:',
    '--tplane-chat-citation-type-memory-border:',
    '--tplane-chat-citation-type-generic-fg:',
    '--tplane-chat-citation-type-generic-bg:',
    '--tplane-chat-citation-type-generic-border:',
  ])('defines %s', (decl) => {
    expect(ROOT_TOKEN_STYLES).toContain(decl);
  });

  it.each([
    ['web', '#1d4ed8', '#eaf1fd'],
    ['file', '#2f684c', '#edf7f1'],
    ['app', '#7a4d12', '#fff5e3'],
    ['memory', '#67508f', '#f3effb'],
    ['generic', '#526071', '#f4f6f8'],
  ])('keeps light %s citation type text at AA contrast', (_type, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});

function relativeLuminance(hex: string): number {
  const [r, g, b] = hex
    .replace('#', '')
    .match(/../g)!
    .map((part) => {
      const channel = parseInt(part, 16) / 255;
      return channel <= 0.03928
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4;
    });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(foreground: string, background: string): number {
  const fg = relativeLuminance(foreground);
  const bg = relativeLuminance(background);
  return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
}

describe('ROOT_TOKEN_STYLES — theme attribute selectors', () => {
  it.each([
    '[data-theme="light"]',
    '[data-theme="dark"]',
    '[data-threadplane-chat-theme="light"]',
    '[data-threadplane-chat-theme="dark"]',
  ])('honors %s as a theme override hook', (selector) => {
    // Both `data-theme` (consumer-facing override) and `data-threadplane-chat-theme`
    // (the chat-lib-internal attribute documented for app-shells that
    // already use `data-theme` for their own picker) must flip tokens.
    expect(ROOT_TOKEN_STYLES).toContain(selector);
  });
});
