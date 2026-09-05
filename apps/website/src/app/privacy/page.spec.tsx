// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../components/ui/Container', () => ({
  Container: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock('../../components/ui/Section', () => ({
  Section: ({ children }: { children: React.ReactNode }) => (
    <section>{children}</section>
  ),
}));
vi.mock('../../components/ui/Eyebrow', () => ({
  Eyebrow: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}));

import PrivacyPage, { metadata } from './page';

/**
 * One canonical policy replaces the previous scattering of analytics promises.
 * These assertions pin what it must say and, just as importantly, what it must
 * never grow back into: a per-event catalog or
 * an absolute guarantee that a future change could quietly falsify.
 */
describe('privacy policy metadata', () => {
  it('declares its own canonical path', () => {
    expect(metadata.alternates?.canonical).toBe('/privacy');
  });

  it('carries a title and description', () => {
    expect(String(metadata.title)).toMatch(/privacy/i);
    expect(String(metadata.description ?? '')).not.toBe('');
  });
});

describe('privacy policy content', () => {
  const text = () => {
    render(<PrivacyPage />);
    return document.body.textContent ?? '';
  };
  it('discloses install identity collection and its disable control', () => {
    const body = text();
    expect(body).toMatch(/install/i);
    expect(body).toMatch(/Git.*email/i);
    expect(body).toContain('DO_NOT_TRACK');
    expect(body).toMatch(/CI/);
  });
  it('explains development-only runtime collection and browser disable controls', () => {
    const body = text();
    expect(body).toMatch(/development builds/i);
    expect(body).toMatch(/production builds.*do not/is);
    expect(body).toContain('THREADPLANE_TELEMETRY_DISABLED');
    expect(body).toMatch(/browser-origin identifier/i);
    expect(body).toMatch(/custom telemetry sink/i);
  });

  it('names the information Threadplane collects', () => {
    const body = text();
    for (const category of [
      /information you submit/i,
      /website analytics/i,
      /product analytics/i,
    ]) {
      expect(body).toMatch(category);
    }
  });

  it('names every processor that receives data', () => {
    const body = text();
    for (const processor of [
      'Vercel',
      'Neon',
      'PostHog',
      'Resend',
      'Google',
      'Anthropic',
    ]) {
      expect(body).toContain(processor);
    }
  });

  it('states indefinite default retention rather than a fixed window', () => {
    expect(text()).toMatch(/indefinite/i);
  });

  it('explains deletion, email opt-out, and how to make contact', () => {
    const body = text();
    expect(body).toMatch(/delet/i);
    expect(body).toMatch(/unsubscribe|opt out|opt-out/i);
    expect(body).toContain('brian@threadplane.ai');
  });

  it('is reachable as a single heading-led document', () => {
    render(<PrivacyPage />);
    expect(
      screen.getByRole('heading', { level: 1, name: /privacy/i })
    ).toBeTruthy();
  });

  it.each([
    ['a never-collected list', /never collect|we will never|do not collect/i],
    ['an absolute guarantee', /\bguarantee/i],
    ['a per-event catalog', /event name|event catalog|property name/i],
  ])('does not make %s', (_label, pattern) => {
    expect(text()).not.toMatch(pattern);
  });
});
