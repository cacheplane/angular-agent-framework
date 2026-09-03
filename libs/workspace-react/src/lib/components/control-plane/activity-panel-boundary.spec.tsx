// @vitest-environment jsdom
import React, { useRef, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActivityPanelBoundary } from './activity-panel-boundary';

function FaultyActivity({ fail }: { fail: boolean }) {
  if (fail) throw new Error('sensitive raw activity error');
  return <p>Recovered activity</p>;
}

describe('ActivityPanelBoundary', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('shows a fixed fallback without exposing raw errors and restores invoking focus on close', () => {
    const onClose = vi.fn();
    const invoker = document.createElement('button');
    invoker.textContent = 'Activity';
    document.body.append(invoker);
    render(
      <ActivityPanelBoundary
        resetKey={0}
        onClose={() => {
          onClose();
          invoker.focus();
        }}
      >
        <FaultyActivity fail />
      </ActivityPanelBoundary>
    );

    expect(
      screen.getByRole('heading', { name: 'Activity unavailable' })
    ).toBeTruthy();
    expect(document.body.textContent).not.toContain(
      'sensitive raw activity error'
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Close Activity unavailable' })
    );
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(invoker);
    invoker.remove();
  });

  it('clears a transient render fault when Activity closes and reopens', () => {
    function Harness() {
      const [resetKey, setResetKey] = useState(0);
      const [fail, setFail] = useState(true);
      const invokerRef = useRef<HTMLButtonElement>(null);
      return (
        <>
          <button
            ref={invokerRef}
            type="button"
            onClick={() => {
              setFail(false);
              setResetKey((current) => current + 1);
            }}
          >
            Reopen Activity
          </button>
          <ActivityPanelBoundary
            resetKey={resetKey}
            onClose={() => invokerRef.current?.focus()}
          >
            <FaultyActivity fail={fail} />
          </ActivityPanelBoundary>
        </>
      );
    }
    render(<Harness />);
    expect(
      screen.getByRole('heading', { name: 'Activity unavailable' })
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: 'Close Activity unavailable' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reopen Activity' }));

    expect(screen.getByText('Recovered activity')).toBeTruthy();
    expect(
      screen.queryByRole('heading', { name: 'Activity unavailable' })
    ).toBeNull();
  });
});
