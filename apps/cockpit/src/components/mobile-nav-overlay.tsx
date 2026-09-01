'use client';

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { X } from 'lucide-react';
import {
  CockpitControlPlane,
  type CockpitControlPlaneProps,
} from './control-plane/cockpit-control-plane';

export interface MobileNavOverlayProps {
  controlPlaneProps: Omit<
    CockpitControlPlaneProps,
    'mobile' | 'onModeSelected' | 'onNavigate'
  >;
  isOpen: boolean;
  onClose: () => void;
  onPresenceChange?: (present: boolean) => void;
  onCapabilityNavigate?: (href: string) => void;
  triggerRef?: RefObject<HTMLButtonElement | null>;
}

export function MobileNavOverlay({
  controlPlaneProps,
  isOpen,
  onClose,
  onPresenceChange,
  onCapabilityNavigate,
  triggerRef,
}: MobileNavOverlayProps) {
  const [state, setState] = useState<'closed' | 'open' | 'closing'>(
    isOpen ? 'open' : 'closed'
  );
  const dialogRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  const onCloseRef = useRef(onClose);
  const onPresenceChangeRef = useRef(onPresenceChange);
  const onCapabilityNavigateRef = useRef(onCapabilityNavigate);
  const triggerRefRef = useRef(triggerRef);
  const restoreFocusRef = useRef(false);
  const pendingNavigationRef = useRef<string | null>(null);
  const cancelScheduledFocusRef = useRef<(() => void) | null>(null);
  const reportedPresenceRef = useRef<boolean | undefined>(undefined);
  stateRef.current = state;
  onCloseRef.current = onClose;
  onPresenceChangeRef.current = onPresenceChange;
  onCapabilityNavigateRef.current = onCapabilityNavigate;
  triggerRefRef.current = triggerRef;

  const cancelScheduledFocus = useCallback(() => {
    cancelScheduledFocusRef.current?.();
    cancelScheduledFocusRef.current = null;
  }, []);

  const requestClose = useCallback(() => {
    if (stateRef.current !== 'open') return;
    restoreFocusRef.current = true;
    setState('closing');
    onCloseRef.current();
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (stateRef.current !== 'open') {
        restoreFocusRef.current = false;
        pendingNavigationRef.current = null;
        cancelScheduledFocus();
      }
      setState((current) => (current === 'open' ? current : 'open'));
      return;
    }
    setState((current) => (current === 'open' ? 'closing' : current));
  }, [cancelScheduledFocus, isOpen]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const desktop = window.matchMedia('(min-width: 48rem)');
    const closeAtDesktop = ({ matches }: Pick<MediaQueryList, 'matches'>) => {
      if (!matches) return;
      restoreFocusRef.current = false;
      pendingNavigationRef.current = null;
      cancelScheduledFocus();
      if (stateRef.current === 'closed') return;
      stateRef.current = 'closed';
      setState('closed');
      onCloseRef.current();
    };
    const handleChange = (event: MediaQueryListEvent) => closeAtDesktop(event);
    desktop.addEventListener('change', handleChange);
    closeAtDesktop(desktop);
    return () => desktop.removeEventListener('change', handleChange);
  }, [cancelScheduledFocus]);

  useEffect(() => {
    if (state !== 'closing') return;
    const timer = setTimeout(() => setState('closed'), 150);
    return () => clearTimeout(timer);
  }, [state]);

  const present = state !== 'closed';
  useLayoutEffect(() => {
    if (reportedPresenceRef.current === present) return;
    reportedPresenceRef.current = present;
    onPresenceChangeRef.current?.(present);
  }, [present]);

  useEffect(
    () => () => {
      if (reportedPresenceRef.current === false) return;
      reportedPresenceRef.current = false;
      onPresenceChangeRef.current?.(false);
    },
    []
  );

  useEffect(() => {
    if (state !== 'closed' || !restoreFocusRef.current) return undefined;
    restoreFocusRef.current = false;
    const restoreFocusAndNavigate = () => {
      cancelScheduledFocusRef.current = null;
      if (stateRef.current !== 'closed') return;
      const destination = pendingNavigationRef.current;
      pendingNavigationRef.current = null;
      triggerRefRef.current?.current?.focus();
      if (destination) onCapabilityNavigateRef.current?.(destination);
    };

    if (typeof window.requestAnimationFrame === 'function') {
      const frame = window.requestAnimationFrame(restoreFocusAndNavigate);
      cancelScheduledFocusRef.current = () =>
        window.cancelAnimationFrame(frame);
    } else {
      const timer = window.setTimeout(restoreFocusAndNavigate, 0);
      cancelScheduledFocusRef.current = () => window.clearTimeout(timer);
    }

    return cancelScheduledFocus;
  }, [cancelScheduledFocus, state]);

  const interceptCapabilityNavigation = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (
        !onCapabilityNavigateRef.current ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target;
      const anchor =
        target instanceof Element
          ? target.closest<HTMLAnchorElement>('a[data-capability-link]')
          : null;
      if (!anchor || anchor.target || anchor.hasAttribute('download')) return;

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      pendingNavigationRef.current =
        destination.pathname + destination.search + destination.hash;
      event.preventDefault();
    },
    []
  );

  useEffect(() => {
    if (!present) return undefined;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [present]);

  useEffect(() => {
    if (state !== 'open') return undefined;
    const dialog = dialogRef.current;
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'a[href], button:not(:disabled), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      );
    focusable()[0]?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusable();
      const first = items[0];
      const last = items.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [requestClose, state]);

  if (state === 'closed') return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Cockpit control plane"
      data-state={state}
      className="cockpit-mobile-control-plane fixed inset-0 z-50 md:hidden"
      onClickCapture={interceptCapabilityNavigation}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <div className="cockpit-mobile-control-plane-panel">
        <header className="cockpit-mobile-control-plane-header">
          <span>Cockpit</span>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close navigation"
            className="cockpit-mobile-control-plane-close"
          >
            <X size={20} strokeWidth={2} aria-hidden="true" />
          </button>
        </header>
        <CockpitControlPlane
          {...controlPlaneProps}
          mobile
          onModeSelected={requestClose}
          onNavigate={requestClose}
        />
      </div>
    </div>
  );
}
