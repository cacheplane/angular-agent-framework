// apps/website/src/components/landing/DemoModal.tsx
'use client';
import { useEffect, useRef } from 'react';
import { trackExternalLinkClick } from '../../lib/analytics/client';

type TabKey = 'langgraph' | 'ag-ui';

export interface DemoModalTab {
  key: TabKey;
  tabLabel: string;
  url: string;
  href: string;
}

interface DemoModalProps {
  open: boolean;
  onClose: () => void;
  tabs: DemoModalTab[];
  active: TabKey;
  onActive: (key: TabKey) => void;
}

export function DemoModal({ open, onClose, tabs, active, onActive }: DemoModalProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const tab = tabs.find((t) => t.key === active) ?? tabs[0];

  // While open: Esc to close, focus trap, body scroll lock, restore focus on close.
  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeBtnRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const f = frameRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])',
      );
      if (!f || f.length === 0) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Live demo"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="demo-modal"
    >
      <div ref={frameRef} className="demo-modal__frame">
        <div className="demo-modal__titlebar">
          <div className="demo-modal__dots" aria-hidden="true">
            {[0, 1, 2].map((i) => <span key={i} className="demo-modal__dot" />)}
          </div>
          <div role="tablist" aria-label="Demo backend" className="demo-modal__tabs">
            {tabs.map((t) => {
              const on = t.key === active;
              return (
                <button key={t.key} role="tab" aria-selected={on} onClick={() => onActive(t.key)}
                  className="demo-modal__tab">
                  {t.tabLabel}
                </button>
              );
            })}
          </div>
          <span className="demo-modal__url">{tab.url}</span>
          <button ref={closeBtnRef} onClick={onClose} aria-label="Close demo"
            className="demo-modal__close">&#215;</button>
        </div>

        <div className="demo-modal__body">
          <iframe src={tab.href} title={`${tab.tabLabel} live demo`}
            className="demo-modal__iframe" />
        </div>

        <div className="demo-modal__footer">
          <span className="demo-modal__hint">Esc or click outside to close &middot; no signup</span>
          <a href={tab.href} target="_blank" rel="noopener noreferrer"
            onClick={() => trackExternalLinkClick(tab.href, { surface: 'home_demo', cta_id: `home_demo_full_${tab.key.replace(/-/g, '_')}`, cta_text: 'Open the full demo' })}
            className="demo-modal__open-link">Open the full demo &#8599;</a>
        </div>
      </div>
    </div>
  );
}
