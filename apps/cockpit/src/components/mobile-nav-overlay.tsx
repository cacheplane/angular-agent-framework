'use client';

import React, { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { CockpitManifestEntry } from '@threadplane/cockpit-registry';
import { X } from 'lucide-react';
import type { ControlPlaneMode } from '@threadplane/ui-react';
import type { NavigationProduct } from '../lib/route-resolution';
import { CockpitControlPlane } from './control-plane/cockpit-control-plane';

interface MobileNavOverlayProps {
  navigationTree: NavigationProduct[];
  manifest: CockpitManifestEntry[];
  entry: CockpitManifestEntry;
  activeMode: ControlPlaneMode;
  onModeChange: (mode: ControlPlaneMode) => void;
  runtimeUrl: string | null;
  isOpen: boolean;
  onClose: () => void;
  triggerRef?: RefObject<HTMLButtonElement | null>;
}

export function MobileNavOverlay({
  navigationTree,
  manifest,
  entry,
  activeMode,
  onModeChange,
  runtimeUrl,
  isOpen,
  onClose,
  triggerRef,
}: MobileNavOverlayProps) {
  const [state, setState] = useState<'closed' | 'open' | 'closing'>(
    isOpen ? 'open' : 'closed',
  );
  const dialogRef = useRef<HTMLDivElement>(null);

  const requestClose = useCallback(() => {
    onClose();
    triggerRef?.current?.focus();
  }, [onClose, triggerRef]);

  useEffect(() => {
    if (isOpen) setState('open');
    else if (state === 'open') setState('closing');
  }, [isOpen, state]);

  useEffect(() => {
    if (state !== 'closing') return;
    const timer = setTimeout(() => setState('closed'), 150);
    return () => clearTimeout(timer);
  }, [state]);

  useEffect(() => {
    if (state !== 'open') return undefined;
    document.body.style.overflow = 'hidden';
    const dialog = dialogRef.current;
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>(
      'a[href], button:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ) ?? []);
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
      document.body.style.overflow = '';
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
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <div className="cockpit-mobile-control-plane-panel">
        <header className="cockpit-mobile-control-plane-header">
          <span>Cockpit</span>
          <button type="button" onClick={requestClose} aria-label="Close navigation">
            <X size={20} strokeWidth={2} aria-hidden="true" />
          </button>
        </header>
        <CockpitControlPlane
          navigationTree={navigationTree}
          manifest={manifest}
          entry={entry}
          activeMode={activeMode}
          onModeChange={(mode) => {
            onModeChange(mode);
            requestClose();
          }}
          runtimeUrl={runtimeUrl}
          mobile
          onNavigate={requestClose}
        />
      </div>
    </div>
  );
}
