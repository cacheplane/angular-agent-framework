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
    '.ngaf-chat-typing-dot',
    '.ngaf-chat-caret',
    '.ngaf-chat-welcome__pulse',
    '.chat-genui-skeleton',
    '.chat-debug__pill--active',
  ])('includes static-fallback override for %s', (selector) => {
    expect(ROOT_TOKEN_STYLES).toContain(selector);
  });
});

describe('ROOT_TOKEN_STYLES — edge-claim primitive', () => {
  it.each([
    '--ngaf-chat-occupy-top:    0px;',
    '--ngaf-chat-occupy-right:  0px;',
    '--ngaf-chat-occupy-bottom: 0px;',
    '--ngaf-chat-occupy-left:   0px;',
  ])('defines default %s on :root', (decl) => {
    expect(ROOT_TOKEN_STYLES).toContain(decl);
  });

  it.each([
    '--ngaf-chat-debug-panel-size-h: 40vh;',
    '--ngaf-chat-debug-panel-size-w: 420px;',
  ])('defines debug panel size token %s', (decl) => {
    expect(ROOT_TOKEN_STYLES).toContain(decl);
  });

  it('maps data-threadplane-chat-sidebar="open" to occupy-right', () => {
    expect(ROOT_TOKEN_STYLES).toMatch(
      /:root\[data-threadplane-chat-sidebar="open"\]\s*\{[^}]*--ngaf-chat-occupy-right:\s*var\(--ngaf-chat-sidebar-width-drawer/,
    );
  });

  it.each([
    ['bottom', '--ngaf-chat-occupy-bottom', '--ngaf-chat-debug-panel-size-h'],
    ['right',  '--ngaf-chat-occupy-right',  '--ngaf-chat-debug-panel-size-w'],
    ['left',   '--ngaf-chat-occupy-left',   '--ngaf-chat-debug-panel-size-w'],
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
    '--ngaf-chat-sidebar-claim-right:  0px;',
    '--ngaf-chat-debug-claim-top:      0px;',
    '--ngaf-chat-debug-claim-right:    0px;',
    '--ngaf-chat-debug-claim-bottom:   0px;',
    '--ngaf-chat-debug-claim-left:     0px;',
  ])('defines per-component default %s', (decl) => {
    expect(ROOT_TOKEN_STYLES).toContain(decl);
  });

  it('sidebar attribute mapping also sets per-component claim var', () => {
    expect(ROOT_TOKEN_STYLES).toMatch(
      /:root\[data-threadplane-chat-sidebar="open"\]\s*\{[^}]*--ngaf-chat-sidebar-claim-right:\s*var\(--ngaf-chat-sidebar-width-drawer/,
    );
  });

  it.each([
    ['bottom', '--ngaf-chat-debug-claim-bottom', '--ngaf-chat-debug-panel-size-h'],
    ['right',  '--ngaf-chat-debug-claim-right',  '--ngaf-chat-debug-panel-size-w'],
    ['left',   '--ngaf-chat-debug-claim-left',   '--ngaf-chat-debug-panel-size-w'],
  ])('debug attribute mapping for %s also sets %s', (dock, claimVar, sizeVar) => {
    const pattern = new RegExp(
      `:root\\[data-threadplane-chat-debug="${dock}"\\]\\s*\\{[^}]*${claimVar}:\\s*var\\(${sizeVar}`,
    );
    expect(ROOT_TOKEN_STYLES).toMatch(pattern);
  });
});

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
