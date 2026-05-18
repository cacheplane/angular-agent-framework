// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { CHAT_SIDENAV_STYLES } from './chat-sidenav.styles';

describe('CHAT_SIDENAV_STYLES — New chat button', () => {
  const normalized = CHAT_SIDENAV_STYLES.replace(/\s+/g, ' ');

  it('uses --ngaf-chat-text as the late-cascade fill (monochrome CTA, not brand-primary)', () => {
    expect(normalized).toMatch(
      /\.chat-sidenav__action\.chat-sidenav__action--new\s*\{[^}]*background:\s*var\(--ngaf-chat-text\)\s*;/,
    );
  });

  it('uses --ngaf-chat-bg as the late-cascade text color (inverse for contrast)', () => {
    expect(normalized).toMatch(
      /\.chat-sidenav__action\.chat-sidenav__action--new\s*\{[^}]*color:\s*var\(--ngaf-chat-bg\)\s*;/,
    );
  });

  it('uses 12px / 18px padding for a slightly larger CTA presence', () => {
    expect(normalized).toMatch(
      /\.chat-sidenav__action\.chat-sidenav__action--new\s*\{[^}]*padding:\s*12px\s+18px\s*;/,
    );
  });

  it('uses brightness(0.92) on hover (subtle darken on the light fill)', () => {
    expect(normalized).toMatch(
      /\.chat-sidenav__action\.chat-sidenav__action--new:hover\s*\{[^}]*filter:\s*brightness\(0\.92\)\s*;/,
    );
  });

  it('keeps the primary-color focus ring (a11y affordance, not chrome)', () => {
    expect(normalized).toMatch(
      /\.chat-sidenav__action--new:focus-visible\s*\{[^}]*outline:\s*2px\s+solid\s+var\(--ngaf-chat-primary\)\s*;/,
    );
  });

  it('uses 8px border-radius (consistent with Search button + thread items)', () => {
    expect(normalized).toMatch(
      /\.chat-sidenav__action\.chat-sidenav__action--new\s*\{[^}]*border-radius:\s*8px\s*;/,
    );
  });
});

describe('CHAT_SIDENAV_STYLES — action button font', () => {
  const normalized = CHAT_SIDENAV_STYLES.replace(/\s+/g, ' ');

  it('generic .chat-sidenav__action has font-family: inherit', () => {
    expect(normalized).toMatch(
      /\.chat-sidenav__action\s*\{[^}]*font-family:\s*inherit\s*;/,
    );
  });

  it('generic .chat-sidenav__action has font-size: var(--ngaf-chat-font-size-sm)', () => {
    expect(normalized).toMatch(
      /\.chat-sidenav__action\s*\{[^}]*font-size:\s*var\(--ngaf-chat-font-size-sm\)\s*;/,
    );
  });

  it('late-cascade New chat uses font-size: var(--ngaf-chat-font-size-sm) (not 13px)', () => {
    expect(normalized).toMatch(
      /\.chat-sidenav__action\.chat-sidenav__action--new\s*\{[^}]*font-size:\s*var\(--ngaf-chat-font-size-sm\)\s*;/,
    );
  });

  it('does NOT use hard-coded 13px for New chat font-size', () => {
    expect(normalized).not.toMatch(
      /\.chat-sidenav__action\.chat-sidenav__action--new\s*\{[^}]*font-size:\s*13px/,
    );
  });
});

describe('CHAT_SIDENAV_STYLES — Archived disclosure', () => {
  const normalized = CHAT_SIDENAV_STYLES.replace(/\s+/g, ' ');

  it('uses sidenav-nav-item padding (8px 12px) — not the small 8px 12px 4px label padding', () => {
    expect(normalized).toMatch(
      /\.chat-sidenav__archived-heading\s*\{[^}]*padding:\s*8px\s+12px\s*;/,
    );
  });

  it('uses 8px border-radius so it reads as a clickable nav item', () => {
    expect(normalized).toMatch(
      /\.chat-sidenav__archived-heading\s*\{[^}]*border-radius:\s*8px\s*;/,
    );
  });

  it('uses --ngaf-chat-text color (full strength, not muted)', () => {
    expect(normalized).toMatch(
      /\.chat-sidenav__archived-heading\s*\{[^}]*color:\s*var\(--ngaf-chat-text\)\s*;/,
    );
  });

  it('uses sm font-size — not the 11px label size', () => {
    expect(normalized).toMatch(
      /\.chat-sidenav__archived-heading\s*\{[^}]*font-size:\s*var\(--ngaf-chat-font-size-sm\)\s*;/,
    );
  });

  it('no longer uppercases the label', () => {
    expect(normalized).not.toMatch(
      /\.chat-sidenav__archived-heading\s*\{[^}]*text-transform:\s*uppercase/,
    );
  });

  it('hovers to surface-alt (matching .chat-sidenav__action)', () => {
    expect(normalized).toMatch(
      /\.chat-sidenav__archived-heading:hover\s*\{[^}]*background:\s*var\(--ngaf-chat-surface-alt\)/,
    );
  });
});
