// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const trackMock = vi.hoisted(() => vi.fn());
const writeTextMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const fetchMock = vi.hoisted(() => vi.fn());

vi.mock('../../lib/analytics/client', () => ({ track: trackMock }));

beforeEach(() => {
  trackMock.mockClear();
  writeTextMock.mockClear();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, text: () => Promise.resolve('# Streaming\n\nbody') });
  Object.assign(navigator, { clipboard: { writeText: writeTextMock } });
  Object.assign(globalThis, { fetch: fetchMock });
});

async function open() {
  const { PageActions } = await import('./PageActions');
  render(<PageActions library="langgraph" section="guides" slug="streaming" />);
  fireEvent.click(screen.getByRole('button', { name: /page actions/i }));
}

describe('PageActions', () => {
  it('copies the raw markdown from the route and fires analytics', async () => {
    await open();
    fireEvent.click(screen.getByRole('menuitem', { name: /copy page as markdown/i }));
    await waitFor(() => expect(writeTextMock).toHaveBeenCalledWith('# Streaming\n\nbody'));
    expect(fetchMock).toHaveBeenCalledWith('/api/markdown/langgraph/guides/streaming');
    expect(trackMock).toHaveBeenCalledWith(
      'docs:copy_code_click',
      expect.objectContaining({ surface: 'docs', cta_id: 'copy_page_markdown' }),
    );
  });

  it('links to ChatGPT with the page URL and to GitHub edit', async () => {
    await open();
    const chatgpt = screen.getByRole('menuitem', { name: /open in chatgpt/i }) as HTMLAnchorElement;
    expect(chatgpt.getAttribute('href')).toContain('https://chatgpt.com/?hints=search&q=');
    expect(chatgpt.getAttribute('href')).toContain(encodeURIComponent('https://threadplane.ai/docs/langgraph/guides/streaming'));
    const github = screen.getByRole('menuitem', { name: /edit on github/i }) as HTMLAnchorElement;
    expect(github.getAttribute('href')).toBe('https://github.com/cacheplane/angular-agent-framework/edit/main/apps/website/content/docs/langgraph/guides/streaming.mdx');
  });
});
