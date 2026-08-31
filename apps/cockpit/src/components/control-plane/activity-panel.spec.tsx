// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import React, { useRef, useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SessionActivityEvent } from '../../lib/runtime/session-activity';
import { ActivityPanel } from './activity-panel';

const events: SessionActivityEvent[] = [
  {
    id: 'old',
    at: '2026-08-31T16:00:00.000Z',
    kind: 'runtime_unresponsive',
    severity: 'error',
    capability: 'persistence',
    summary: 'Runtime unresponsive',
  },
  {
    id: 'new',
    at: '2026-08-31T17:00:00.000Z',
    kind: 'runtime_recovered',
    severity: 'success',
    capability: 'streaming',
    summary: 'Runtime recovered',
  },
];

describe('ActivityPanel', () => {
  it('renders safe events newest first with severity icons and cross-capability labels only', () => {
    render(
      <ActivityPanel
        events={events}
        currentCapability="streaming"
        onClose={vi.fn()}
        onClear={vi.fn()}
        formatTimestamp={(at) => at.slice(11, 16)}
      />
    );

    const rows = screen.getAllByRole('listitem');
    expect(
      rows.map(
        (row) => row.querySelector('[data-activity-summary]')?.textContent
      )
    ).toEqual(['Runtime recovered', 'Runtime unresponsive']);
    expect(rows[0]?.querySelector('[data-activity-capability]')).toBeNull();
    expect(
      rows[1]?.querySelector('[data-activity-capability]')?.textContent
    ).toBe('persistence');
    expect(
      rows[0]?.querySelector('[data-activity-severity-icon="success"]')
    ).toBeTruthy();
    expect(
      rows[1]?.querySelector('[data-activity-severity-icon="error"]')
    ).toBeTruthy();
    expect(screen.getByText('17:00').tagName).toBe('TIME');
    expect(
      document
        .querySelector('[data-activity-connector]')
        ?.getAttribute('aria-hidden')
    ).toBe('true');
    expect(document.querySelector('[aria-live]')).toBeNull();
  });

  it('renders the exact empty state without a passive live region', () => {
    render(
      <ActivityPanel
        events={[]}
        currentCapability="streaming"
        onClose={vi.fn()}
        onClear={vi.fn()}
      />
    );
    expect(
      screen.getByText('No operational activity this session.')
    ).toBeTruthy();
    expect(document.querySelector('[aria-live]')).toBeNull();
  });

  it('exposes the attention label contract when attention is present', () => {
    render(
      <ActivityPanel
        events={events}
        currentCapability="streaming"
        attention
        onClose={vi.fn()}
        onClear={vi.fn()}
      />
    );
    expect(
      screen.getByRole('list', { name: 'Activity, attention required' })
    ).toBeTruthy();
  });

  it('restores invoking focus through the close callback contract', () => {
    function Harness() {
      const [open, setOpen] = useState(true);
      const invokerRef = useRef<HTMLButtonElement>(null);
      return (
        <>
          <button ref={invokerRef} type="button">
            Activity
          </button>
          {open ? (
            <ActivityPanel
              events={events}
              currentCapability="streaming"
              onClear={vi.fn()}
              onClose={() => {
                setOpen(false);
                invokerRef.current?.focus();
              }}
            />
          ) : null}
        </>
      );
    }
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Close Activity' }));

    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Activity' })
    );
  });

  it('keeps Clear session activity inside the local ellipsis menu', async () => {
    const onClear = vi.fn().mockResolvedValue(undefined);
    render(
      <ActivityPanel
        events={events}
        currentCapability="streaming"
        onClose={vi.fn()}
        onClear={onClear}
      />
    );
    expect(
      screen.queryByRole('menuitem', { name: 'Clear session activity' })
    ).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Activity actions' }));
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Clear session activity' })
    );

    await waitFor(() => expect(onClear).toHaveBeenCalledTimes(1));
  });
});
