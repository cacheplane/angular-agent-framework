// apps/website/src/components/landing/DemoModal.tsx
'use client';
import { useEffect, useRef } from 'react';
import { tokens } from '@threadplane/design-tokens';
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
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(16,18,32,.55)',
        animation: 'demoModalBackdrop .16s ease-out',
      }}
    >
      <style>{`
        @keyframes demoModalBackdrop { from { opacity: 0 } to { opacity: 1 } }
        @keyframes demoModalFrame { from { transform: scale(.96); opacity:.6 } to { transform: scale(1); opacity:1 } }
        .demo-modal__frame {
          width: min(96vw, calc(90vh * 16 / 10));
          background: ${tokens.surfaces.surface};
          border-radius: ${tokens.radius.lg};
          box-shadow: 0 24px 60px rgba(0,0,0,.45);
          overflow: hidden;
          display: flex; flex-direction: column;
          animation: demoModalFrame .16s ease-out;
        }
        .demo-modal__body { width: 100%; aspect-ratio: 16 / 10; background: #15161f; }
        @media (max-width: 640px) {
          .demo-modal__frame { width: 100vw; height: 100dvh; border-radius: 0; }
          .demo-modal__body { aspect-ratio: auto; flex: 1 1 auto; }
        }
        @media (prefers-reduced-motion: reduce) {
          [role="dialog"], .demo-modal__frame { animation: none !important; }
        }
      `}</style>

      <div ref={frameRef} className="demo-modal__frame">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: tokens.surfaces.surfaceTinted, borderBottom: `1px solid ${tokens.surfaces.border}` }}>
          <div style={{ display: 'flex', gap: 5 }} aria-hidden="true">
            {[0, 1, 2].map((i) => <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#cdd2df' }} />)}
          </div>
          <div role="tablist" aria-label="Demo backend" style={{ display: 'flex', gap: 5 }}>
            {tabs.map((t) => {
              const on = t.key === active;
              return (
                <button key={t.key} role="tab" aria-selected={on} onClick={() => onActive(t.key)}
                  style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 7, border: 'none', cursor: 'pointer',
                    background: on ? tokens.colors.accent : tokens.colors.accentSurface, color: on ? tokens.colors.textInverted : tokens.colors.textMuted }}>
                  {t.tabLabel}
                </button>
              );
            })}
          </div>
          <span style={{ flex: 1, textAlign: 'center', fontFamily: tokens.typography.fontMono, fontSize: 12, fontWeight: 600, color: tokens.colors.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tab.url}</span>
          <button ref={closeBtnRef} onClick={onClose} aria-label="Close demo"
            style={{ width: 28, height: 28, borderRadius: 7, border: 'none', cursor: 'pointer', background: tokens.colors.accentSurface, color: tokens.colors.textSecondary, fontSize: 16, lineHeight: 1 }}>&#215;</button>
        </div>

        <div className="demo-modal__body">
          <iframe src={tab.href} title={`${tab.tabLabel} live demo`}
            style={{ width: '100%', height: '100%', border: 'none', display: 'block' }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderTop: `1px solid ${tokens.surfaces.border}`, background: tokens.surfaces.surface }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: tokens.colors.textMuted }}>Esc or click outside to close &middot; MIT &middot; no signup</span>
          <a href={tab.href} target="_blank" rel="noopener noreferrer"
            onClick={() => trackExternalLinkClick(tab.href, { surface: 'home_demo', cta_id: `home_demo_full_${tab.key.replace(/-/g, '_')}`, cta_text: 'Open the full demo' })}
            style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600, color: tokens.colors.accent, textDecoration: 'none' }}>Open the full demo &#8599;</a>
        </div>
      </div>
    </div>
  );
}
