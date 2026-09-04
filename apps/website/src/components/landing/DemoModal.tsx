// apps/website/src/components/landing/DemoModal.tsx
'use client';
import { trackExternalLinkClick } from '../../lib/analytics/client';
import { Modal } from '../ui/Modal';

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
  const tab = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <Modal open={open} onClose={onClose} label="Live demo" frameClassName="demo-modal__frame">
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
    </Modal>
  );
}
