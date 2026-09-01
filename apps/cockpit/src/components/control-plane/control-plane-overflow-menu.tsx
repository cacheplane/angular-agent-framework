// SPDX-License-Identifier: MIT
'use client';

import React, {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Ellipsis } from 'lucide-react';

export interface ControlPlaneOverflowMenuProps {
  label: string;
  children: ReactNode;
  tabIndex?: number;
  placement?: 'start' | 'center' | 'end';
}

export function ControlPlaneOverflowMenu({
  label,
  children,
  tabIndex,
  placement = 'end',
}: ControlPlaneOverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const tooltipId = useId();

  useEffect(() => {
    if (!open) return undefined;

    menuRef.current
      ?.querySelector<HTMLElement>(
        '[role="menuitem"]:not(:disabled):not([aria-disabled="true"])'
      )
      ?.focus();

    const closeFromOutside = (event: Event) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const closeFromEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeFromOutside);
    document.addEventListener('click', closeFromOutside);
    document.addEventListener('keydown', closeFromEscape, true);
    return () => {
      document.removeEventListener('pointerdown', closeFromOutside);
      document.removeEventListener('click', closeFromOutside);
      document.removeEventListener('keydown', closeFromEscape, true);
      triggerRef.current?.focus();
    };
  }, [open]);

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const consume = () => {
      event.preventDefault();
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();
    };

    if (event.key === 'Tab') {
      consume();
      setOpen(false);
      return;
    }

    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    consume();
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []
    );
    const enabled = items.filter(
      (item) =>
        !item.matches(':disabled') &&
        item.getAttribute('aria-disabled') !== 'true'
    );
    if (enabled.length === 0) return;

    if (event.key === 'Home' || event.key === 'End') {
      enabled[event.key === 'Home' ? 0 : enabled.length - 1]?.focus();
      return;
    }

    const direction = event.key === 'ArrowDown' ? 1 : -1;
    let current = items.indexOf(document.activeElement as HTMLElement);
    if (current < 0) current = direction === 1 ? -1 : 0;
    for (let offset = 1; offset <= items.length; offset += 1) {
      const candidate =
        items[(current + direction * offset + items.length) % items.length];
      if (candidate && enabled.includes(candidate)) {
        candidate.focus();
        return;
      }
    }
  };

  return (
    <div
      ref={rootRef}
      data-control-plane-overflow-menu-root
      data-overflow-placement={placement}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-describedby={tooltipId}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        tabIndex={tabIndex}
        data-control-plane-action
        data-control-plane-overflow-trigger
        onClick={() => setOpen((current) => !current)}
      >
        <Ellipsis size={17} strokeWidth={2} aria-hidden="true" />
        <span id={tooltipId} role="tooltip" data-control-plane-tooltip>
          {label}
        </span>
      </button>
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          data-control-plane-overflow-menu
          onKeyDown={onMenuKeyDown}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export interface ControlPlaneOverflowMenuItemProps {
  children: ReactNode;
  onSelect: () => unknown | PromiseLike<unknown>;
  disabled?: boolean;
}

export function ControlPlaneOverflowMenuItem({
  children,
  onSelect,
  disabled = false,
}: ControlPlaneOverflowMenuItemProps) {
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);

  const select = async () => {
    if (disabled || pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    try {
      await onSelect();
    } catch {
      // The owning operational component reports semantic failure outcomes.
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      aria-disabled={disabled || pending || undefined}
      aria-busy={pending || undefined}
      data-control-plane-overflow-item
      onClick={() => void select()}
    >
      {children}
    </button>
  );
}
