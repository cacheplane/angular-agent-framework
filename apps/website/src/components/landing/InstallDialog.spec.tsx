// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { INSTALL_OPTIONS } from '../../lib/positioning';

const trackCtaClickMock = vi.hoisted(() => vi.fn());
const writeTextMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('../../lib/analytics/client', () => ({ trackCtaClick: trackCtaClickMock, track: vi.fn() }));
vi.mock('../ui/Button', () => ({
  Button: ({ children, href, onClick }: { children: React.ReactNode; href?: string; onClick?: () => void }) =>
    href ? <a href={href} onClick={onClick}>{children}</a> : <button onClick={onClick}>{children}</button>,
}));

beforeEach(() => {
  trackCtaClickMock.mockClear();
  writeTextMock.mockClear();
  Object.assign(navigator, { clipboard: { writeText: writeTextMock } });
});

describe('InstallDialog', () => {
  it('opens on the fake-agent variant and shows its command and snippet', async () => {
    const { InstallDialog } = await import('./InstallDialog');
    render(<InstallDialog open onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Install Threadplane' });
    const radios = within(dialog).getAllByRole('radio');
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
    expect(within(dialog).getByTestId('install-command').textContent).toBe(INSTALL_OPTIONS[0].command);
    expect(within(dialog).getByTestId('install-snippet').textContent).toContain('provideFakeAgent');
    expect(within(dialog).getByRole('link', { name: /Open the full quickstart/ }).getAttribute('href')).toBe(INSTALL_OPTIONS[0].quickstartHref);
  });

  it('switching to AG-UI swaps command, snippet and quickstart link, and tracks the toggle', async () => {
    const { InstallDialog } = await import('./InstallDialog');
    render(<InstallDialog open onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('radio', { name: 'AG-UI' }));
    expect(screen.getByTestId('install-command').textContent).toBe(INSTALL_OPTIONS[2].command);
    expect(screen.getByTestId('install-snippet').textContent).toContain('@threadplane/ag-ui');
    expect(screen.getByRole('link', { name: /Open the full quickstart/ }).getAttribute('href')).toBe(INSTALL_OPTIONS[2].quickstartHref);
  });

  it('arrow keys move the radio selection', async () => {
    const { InstallDialog } = await import('./InstallDialog');
    render(<InstallDialog open onClose={vi.fn()} />);
    const first = screen.getByRole('radio', { name: 'Try without a backend' });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: 'LangGraph' }).getAttribute('aria-checked')).toBe('true');
  });

  it('copy writes the visible command and fires hero_install with the adapter', async () => {
    const { InstallDialog } = await import('./InstallDialog');
    render(<InstallDialog open onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('radio', { name: 'LangGraph' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy install command' }));
    expect(writeTextMock).toHaveBeenCalledWith(INSTALL_OPTIONS[1].command);
    expect(trackCtaClickMock).toHaveBeenCalledWith(expect.objectContaining({ cta_id: 'hero_install', adapter: 'langgraph', surface: 'home', track: 'developer' }));
    expect(await screen.findByText(/Copied/)).toBeTruthy();
  });

  it('quickstart link fires hero_quickstart with the adapter', async () => {
    const { InstallDialog } = await import('./InstallDialog');
    render(<InstallDialog open onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('link', { name: /Open the full quickstart/ }));
    expect(trackCtaClickMock).toHaveBeenCalledWith(expect.objectContaining({ cta_id: 'hero_quickstart', adapter: 'fake' }));
  });
});
