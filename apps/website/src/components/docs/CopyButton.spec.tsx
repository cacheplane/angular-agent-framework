// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const trackMock = vi.hoisted(() => vi.fn());
const writeTextMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('../../lib/analytics/client', () => ({
  track: trackMock,
}));

beforeEach(() => {
  trackMock.mockClear();
  writeTextMock.mockClear();
  Object.assign(navigator, { clipboard: { writeText: writeTextMock } });
});

describe('CopyButton', () => {
  it('renders an accessible copy button by default', async () => {
    const { CopyButton } = await import('./CopyButton');
    render(<CopyButton text="npm i @threadplane/langgraph" />);
    expect(screen.getByRole('button', { name: /copy install command/i })).toBeTruthy();
  });

  it('copies the text, shows copied state, and fires docs:copy_code_click with cta_id=copy_install', async () => {
    const { CopyButton } = await import('./CopyButton');
    render(<CopyButton text="npm i @threadplane/langgraph" />);
    fireEvent.click(screen.getByRole('button', { name: /copy install command/i }));
    expect(writeTextMock).toHaveBeenCalledWith('npm i @threadplane/langgraph');
    await screen.findByRole('button', { name: /copied/i });
    expect(trackMock).toHaveBeenCalledWith(
      'docs:copy_code_click',
      expect.objectContaining({ surface: 'docs', cta_id: 'copy_install' }),
    );
  });
});
