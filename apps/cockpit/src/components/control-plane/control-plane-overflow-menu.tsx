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
}

export function ControlPlaneOverflowMenu({
  label,
  children,
  tabIndex,
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
      ?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')
      ?.focus();

    const closeFromOutside = (event: Event) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const closeFromEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeFromOutside);
    document.addEventListener('click', closeFromOutside);
    document.addEventListener('keydown', closeFromEscape);
    return () => {
      document.removeEventListener('pointerdown', closeFromOutside);
      document.removeEventListener('click', closeFromOutside);
      document.removeEventListener('keydown', closeFromEscape);
      triggerRef.current?.focus();
    };
  }, [open]);

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();
      setOpen(false);
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>(
        '[role="menuitem"]:not(:disabled):not([aria-disabled="true"])'
      ) ?? []
    );
    if (items.length === 0) return;
    const current = Math.max(
      0,
      items.indexOf(document.activeElement as HTMLElement)
    );
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
        ? items.length - 1
        : event.key === 'ArrowDown'
        ? (current + 1) % items.length
        : (current - 1 + items.length) % items.length;
    event.preventDefault();
    items[nextIndex]?.focus();
  };

  return (
    <div ref={rootRef} data-control-plane-overflow-menu-root>
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

  const select = async () => {
    if (disabled || pending) return;
    setPending(true);
    try {
      await onSelect();
    } catch {
      // The owning operational component reports semantic failure outcomes.
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      data-control-plane-overflow-item
      onClick={() => void select()}
    >
      {children}
    </button>
  );
}
