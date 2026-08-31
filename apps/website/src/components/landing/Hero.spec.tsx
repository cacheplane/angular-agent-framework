// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { HERO_CHIPS, HERO_SUBHEAD, POSITIONING_PROOF_POINTS } from '../../lib/positioning';

const trackMock = vi.hoisted(() => vi.fn());
const writeTextMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('../../lib/analytics/client', () => ({
  track: trackMock,
}));

// Stub design-system primitives — they don't import React (rely on Next's
// automatic JSX runtime) but the vitest transform here doesn't auto-inject.
// We're testing Hero's CTA wiring, not the wrappers.
vi.mock('../ui/Container', () => ({
  Container: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('../ui/Section', () => ({
  Section: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
}));
vi.mock('../ui/Eyebrow', () => ({
  Eyebrow: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));
vi.mock('../ui/BrowserFrame', () => ({
  BrowserFrame: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('../ui/Pill', () => ({
  Pill: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));
vi.mock('../ui/Button', () => ({
  Button: ({ children, href, onClick }: { children: React.ReactNode; href?: string; onClick?: () => void }) =>
    href ? (
      <a href={href} onClick={onClick}>{children}</a>
    ) : (
      <button onClick={onClick}>{children}</button>
    ),
}));

beforeEach(() => {
  trackMock.mockClear();
  writeTextMock.mockClear();
  Object.assign(navigator, { clipboard: { writeText: writeTextMock } });
});

describe('Hero', () => {
  it('renders the locked H1, problem-first subhead, and capability chips', async () => {
    const { Hero } = await import('./Hero');
    render(<Hero />);
    expect(screen.getByRole('heading', { level: 1 }).textContent)
      .toBe('Ship production agent UIs in Angular.');
    const subhead = document.querySelector('.hero-subhead');
    expect(subhead?.textContent).toBe(HERO_SUBHEAD);
    const chipRow = screen.getByRole('list', { name: 'Capabilities' });
    for (const chip of HERO_CHIPS) {
      expect(within(chipRow).getByText(chip)).toBeTruthy();
    }
    for (const proofPoint of POSITIONING_PROOF_POINTS) {
      // 'LangGraph + AG-UI' appears both as a chip and as a proof pill label,
      // so use getAllByText rather than getByText (which throws on multiple matches).
      expect(screen.getAllByText(proofPoint.label).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('primary CTA copies the install command and fires cta_id=hero_install', async () => {
    const { Hero } = await import('./Hero');
    render(<Hero />);
    const btn = screen.getByRole('button', { name: /Install LangGraph starter/i });
    fireEvent.click(btn);
    expect(writeTextMock).toHaveBeenCalledWith('npm install @threadplane/chat @threadplane/langgraph');
    expect(trackMock).toHaveBeenCalledWith('marketing:cta_click', expect.objectContaining({
      cta_id: 'hero_install',
      track: 'developer',
      surface: 'home',
    }));
  });

  it('secondary CTA links to /contact and fires cta_id=hero_talk_to_engineers', async () => {
    const { Hero } = await import('./Hero');
    render(<Hero />);
    const link = screen.getByRole('link', { name: /Talk to our engineers/i });
    expect(link.getAttribute('href')).toBe('/contact?source=home_hero&track=enterprise');
    fireEvent.click(link);
    expect(trackMock).toHaveBeenCalledWith('marketing:cta_click', expect.objectContaining({
      cta_id: 'hero_talk_to_engineers',
      track: 'enterprise',
      surface: 'home',
    }));
  });
});
