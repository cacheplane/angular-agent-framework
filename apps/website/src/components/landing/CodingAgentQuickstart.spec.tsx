// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CODING_AGENT_PROMPT } from '../../lib/positioning';

const trackCtaClickMock = vi.hoisted(() => vi.fn());
const writeTextMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('../../lib/analytics/client', () => ({
  trackCtaClick: trackCtaClickMock,
  track: vi.fn(),
}));
vi.mock('../ui/Container', () => ({
  Container: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('../ui/Section', () => ({
  Section: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
}));
vi.mock('../ui/SectionHeader', () => ({
  SectionHeader: ({ heading }: { heading: React.ReactNode }) => <h2>{heading}</h2>,
}));
vi.mock('../ui/Button', () => ({
  Button: ({
    children,
    href,
    onClick,
  }: {
    children: React.ReactNode;
    href?: string;
    onClick?: () => void;
  }) =>
    href ? (
      <a href={href} onClick={onClick}>
        {children}
      </a>
    ) : (
      <button onClick={onClick}>{children}</button>
    ),
}));

beforeEach(() => {
  trackCtaClickMock.mockClear();
  writeTextMock.mockClear();
  Object.assign(navigator, { clipboard: { writeText: writeTextMock } });
});

describe('CodingAgentQuickstart', () => {
  it('renders the maintained prompt verbatim and the four links', async () => {
    const { CodingAgentQuickstart } = await import('./CodingAgentQuickstart');
    render(<CodingAgentQuickstart />);
    expect(screen.getByTestId('coding-agent-prompt').textContent).toBe(CODING_AGENT_PROMPT);
    expect(screen.getByRole('link', { name: /Read AGENTS.md/ }).getAttribute('href')).toBe('/AGENTS.md');
    expect(screen.getByRole('link', { name: /full agent reference/ }).getAttribute('href')).toBe('/llms-full.txt');
    expect(screen.getByRole('link', { name: /human quickstart/ }).getAttribute('href')).toBe(
      '/docs/chat/getting-started/try-without-a-backend',
    );
  });

  it('copy writes the prompt and tracks without sending the text', async () => {
    const { CodingAgentQuickstart } = await import('./CodingAgentQuickstart');
    render(<CodingAgentQuickstart />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy setup prompt' }));
    expect(writeTextMock).toHaveBeenCalledWith(CODING_AGENT_PROMPT);
    const call = trackCtaClickMock.mock.calls.find((c) => c[0].cta_id === 'home_coding_agent_prompt')?.[0];
    expect(call).toBeTruthy();
    expect(JSON.stringify(call)).not.toContain('Add Threadplane to this Angular application');
  });
});
