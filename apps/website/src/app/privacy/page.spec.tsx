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
 * never grow back into: a per-event catalog, an installation-behavior claim, or
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
    ['an installation behavior claim', /install/i],
    ['a never-collected list', /never collect|we will never|do not collect/i],
    ['an absolute guarantee', /\bguarantee/i],
    ['a per-event catalog', /event name|event catalog|property name/i],
  ])('does not make %s', (_label, pattern) => {
    expect(text()).not.toMatch(pattern);
  });
});
