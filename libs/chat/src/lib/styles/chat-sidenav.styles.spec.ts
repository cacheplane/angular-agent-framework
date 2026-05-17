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
});
