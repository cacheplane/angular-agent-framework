'use client';

import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { STAGE_CLOSE } from '../../lib/positioning';
import { InstallDialog } from './InstallDialog';

export function StageInstallAction({ tabIndex }: { tabIndex?: number }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <a
        href={STAGE_CLOSE.cta.href}
        className="stage-install-cta"
        tabIndex={tabIndex}
        aria-haspopup="dialog"
        onClick={(event) => {
          event.preventDefault();
          setOpen(true);
        }}
      >
        {STAGE_CLOSE.cta.label} →
      </a>
      {/* Escape the pinned stage's clipping and animated cue transforms. */}
      {open && createPortal(<InstallDialog open onClose={close} />, document.body)}
    </>
  );
}
