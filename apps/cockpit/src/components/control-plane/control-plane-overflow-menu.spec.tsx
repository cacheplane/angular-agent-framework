// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {
  ControlPlaneActionBar,
  ControlPlaneIconButton,
  ControlPlaneUtilityPanel,
} from '@threadplane/ui-react';
import { describe, expect, it, vi } from 'vitest';
import {
  ControlPlaneOverflowMenu,
  ControlPlaneOverflowMenuItem,
} from './control-plane-overflow-menu';

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}

function renderMenu(firstAction: () => unknown | Promise<unknown> = vi.fn()) {
  render(
    <>
      <ControlPlaneOverflowMenu label="More runtime actions">
        <ControlPlaneOverflowMenuItem onSelect={firstAction}>
          Copy diagnostics
        </ControlPlaneOverflowMenuItem>
        <ControlPlaneOverflowMenuItem onSelect={vi.fn()}>
          Clear session activity
        </ControlPlaneOverflowMenuItem>
      </ControlPlaneOverflowMenu>
      <button type="button">Outside</button>
    </>
  );
  const trigger = screen.getByRole('button', { name: 'More runtime actions' });
  fireEvent.click(trigger);
  return trigger;
}

describe('ControlPlaneOverflowMenu', () => {
  it('focuses the first item and supports wrapping keyboard navigation', async () => {
    renderMenu();
    const items = screen.getAllByRole('menuitem');
    const first = items[0];
    const last = items[1];
    if (!first || !last) throw new Error('Expected two overflow menu items');

    await waitFor(() => expect(document.activeElement).toBe(first));
    fireEvent.keyDown(first, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(last, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: 'End' });
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(last, { key: 'Home' });
    expect(document.activeElement).toBe(first);
  });

  it('contains menu navigation inside a surrounding action toolbar', async () => {
    render(
      <ControlPlaneActionBar label="Runtime actions">
        <ControlPlaneIconButton
          label="Recheck"
          icon={<span aria-hidden="true">R</span>}
          onClick={vi.fn()}
        />
        <ControlPlaneIconButton
          label="Reload runtime"
          icon={<span aria-hidden="true">L</span>}
          onClick={vi.fn()}
        />
        <ControlPlaneOverflowMenu label="More runtime actions">
          <ControlPlaneOverflowMenuItem onSelect={vi.fn()}>
            Copy diagnostics
          </ControlPlaneOverflowMenuItem>
          <ControlPlaneOverflowMenuItem onSelect={vi.fn()}>
            Clear session activity
          </ControlPlaneOverflowMenuItem>
        </ControlPlaneOverflowMenu>
      </ControlPlaneActionBar>
    );
    const recheck = screen.getByRole('button', { name: 'Recheck' });
    const reload = screen.getByRole('button', { name: 'Reload runtime' });
    fireEvent.click(
      screen.getByRole('button', { name: 'More runtime actions' })
    );
    const items = screen.getAllByRole('menuitem');
    const first = items[0];
    const last = items[1];
    if (!first || !last) throw new Error('Expected two overflow menu items');
    await waitFor(() => expect(document.activeElement).toBe(first));

    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(last, { key: 'Home' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: 'End' });
    expect(document.activeElement).toBe(last);
    expect(document.activeElement).not.toBe(recheck);
    expect(document.activeElement).not.toBe(reload);
  });

  it('closes on Escape and restores focus to its trigger', async () => {
    const trigger = renderMenu();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getAllByRole('menuitem')[0])
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('consumes a focused menu item Escape before a containing utility panel', async () => {
    const onClose = vi.fn();
    render(
      <ControlPlaneUtilityPanel title="Activity" onClose={onClose}>
        <ControlPlaneOverflowMenu label="Activity actions">
          <ControlPlaneOverflowMenuItem onSelect={vi.fn()}>
            Clear session activity
          </ControlPlaneOverflowMenuItem>
        </ControlPlaneOverflowMenu>
      </ControlPlaneUtilityPanel>
    );
    const trigger = screen.getByRole('button', { name: 'Activity actions' });
    fireEvent.click(trigger);
    const item = screen.getByRole('menuitem', {
      name: 'Clear session activity',
    });
    await waitFor(() => expect(document.activeElement).toBe(item));

    fireEvent.keyDown(item, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(document.activeElement).toBe(trigger);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Activity' })).toBeTruthy();
  });

  it('consumes trigger Escape while open before a containing utility panel', async () => {
    const onClose = vi.fn();
    render(
      <ControlPlaneUtilityPanel title="Activity" onClose={onClose}>
        <ControlPlaneOverflowMenu label="Activity actions">
          <ControlPlaneOverflowMenuItem onSelect={vi.fn()}>
            Clear session activity
          </ControlPlaneOverflowMenuItem>
        </ControlPlaneOverflowMenu>
      </ControlPlaneUtilityPanel>
    );
    const trigger = screen.getByRole('button', { name: 'Activity actions' });
    fireEvent.click(trigger);
    const item = screen.getByRole('menuitem', {
      name: 'Clear session activity',
    });
    await waitFor(() => expect(document.activeElement).toBe(item));
    trigger.focus();

    fireEvent.keyDown(trigger, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(document.activeElement).toBe(trigger);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Activity' })).toBeTruthy();
  });

  it.each([
    ['Tab', false],
    ['Shift+Tab', true],
  ] as const)(
    'closes and restores its trigger before %s leaves a containing utility panel',
    async (_label, shiftKey) => {
      const onClose = vi.fn();
      render(
        <ControlPlaneUtilityPanel title="Activity" onClose={onClose}>
          <ControlPlaneOverflowMenu label="Activity actions">
            <ControlPlaneOverflowMenuItem onSelect={vi.fn()}>
              Clear session activity
            </ControlPlaneOverflowMenuItem>
          </ControlPlaneOverflowMenu>
        </ControlPlaneUtilityPanel>
      );
      const trigger = screen.getByRole('button', { name: 'Activity actions' });
      fireEvent.click(trigger);
      const item = screen.getByRole('menuitem', {
        name: 'Clear session activity',
      });
      await waitFor(() => expect(document.activeElement).toBe(item));

      fireEvent.keyDown(item, { key: 'Tab', shiftKey });

      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
      expect(document.activeElement).toBe(trigger);
      expect(onClose).not.toHaveBeenCalled();
    }
  );

  it('consumes Escape before its utility panel when focus moved outside the menu', async () => {
    const onClose = vi.fn();
    render(
      <ControlPlaneUtilityPanel title="Activity" onClose={onClose}>
        <ControlPlaneOverflowMenu label="Activity actions">
          <ControlPlaneOverflowMenuItem onSelect={vi.fn()}>
            Clear session activity
          </ControlPlaneOverflowMenuItem>
        </ControlPlaneOverflowMenu>
      </ControlPlaneUtilityPanel>
    );
    const trigger = screen.getByRole('button', { name: 'Activity actions' });
    fireEvent.click(trigger);
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('menuitem', { name: 'Clear session activity' })
      )
    );
    const panelClose = screen.getByRole('button', { name: 'Close Activity' });
    panelClose.focus();

    fireEvent.keyDown(panelClose, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(document.activeElement).toBe(trigger);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Activity' })).toBeTruthy();
  });

  it('closes on an outside pointer interaction and restores trigger focus', async () => {
    const trigger = renderMenu();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getAllByRole('menuitem')[0])
    );

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }));

    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('also closes for a click-only outside interaction', async () => {
    const trigger = renderMenu();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getAllByRole('menuitem')[0])
    );

    fireEvent.click(screen.getByRole('button', { name: 'Outside' }));

    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('remains usable when an asynchronous item rejects', async () => {
    const action = vi
      .fn()
      .mockRejectedValue(new Error('clipboard unavailable'));
    renderMenu(action);
    const item = screen.getByRole('menuitem', {
      name: 'Copy diagnostics',
    }) as HTMLButtonElement;

    fireEvent.click(item);

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(item.disabled).toBe(false));
    expect(screen.getByRole('menu')).toBeTruthy();
    fireEvent.click(item);
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
  });

  it('keeps a pending item focused and focusable while preventing repeat activation', async () => {
    const pending = deferred<void>();
    const action = vi.fn().mockReturnValue(pending.promise);
    renderMenu(action);
    const item = screen.getByRole('menuitem', {
      name: 'Copy diagnostics',
    }) as HTMLButtonElement;
    await waitFor(() => expect(document.activeElement).toBe(item));

    fireEvent.click(item);

    expect(item.disabled).toBe(false);
    expect(item.getAttribute('aria-busy')).toBe('true');
    expect(item.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(item);
    fireEvent.click(item);
    expect(action).toHaveBeenCalledTimes(1);

    await act(async () => pending.resolve());

    expect(item.getAttribute('aria-busy')).toBeNull();
    expect(item.getAttribute('aria-disabled')).toBeNull();
    expect(document.activeElement).toBe(item);
    fireEvent.click(item);
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
  });

  it('moves from a pending item to the next enabled menu item', async () => {
    const pending = deferred<void>();
    renderMenu(vi.fn().mockReturnValue(pending.promise));
    const items = screen.getAllByRole('menuitem');
    const first = items[0];
    const second = items[1];
    if (!first || !second) throw new Error('Expected two overflow menu items');
    await waitFor(() => expect(document.activeElement).toBe(first));
    fireEvent.click(first);

    fireEvent.keyDown(first, { key: 'ArrowDown' });

    expect(document.activeElement).toBe(second);
    await act(async () => pending.resolve());
  });
});
