'use client';
import { useCallback, useRef, useState, type KeyboardEvent } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { trackCtaClick } from '../../lib/analytics/client';
import {
  COMPONENT_SNIPPET,
  HERO_PRIMARY_LABEL,
  HERO_TRUST_LINE,
  INSTALL_OPTIONS,
  type InstallVariant,
} from '../../lib/positioning';

interface InstallDialogProps {
  open: boolean;
  onClose: () => void;
}

const COPY_FEEDBACK_MS = 1500;
const TITLE_ID = 'install-dialog-title';

export function InstallDialog({ open, onClose }: InstallDialogProps) {
  const [variant, setVariant] = useState<InstallVariant>('fake');
  const [copied, setCopied] = useState(false);
  const radioRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const option = INSTALL_OPTIONS.find((o) => o.key === variant) ?? INSTALL_OPTIONS[0];

  const onRadioKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (index + delta + INSTALL_OPTIONS.length) % INSTALL_OPTIONS.length;
    setVariant(INSTALL_OPTIONS[next].key);
    radioRefs.current[next]?.focus();
  };

  const copy = useCallback(async () => {
    trackCtaClick({ cta_id: 'hero_install', adapter: option.key, track: 'developer', surface: 'home' });
    try {
      await navigator.clipboard?.writeText(option.command);
      setCopied(true);
      setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    } catch {
      // Clipboard blocked: the command is visible, the user can select it.
    }
  }, [option]);

  return (
    <Modal open={open} onClose={onClose} label={HERO_PRIMARY_LABEL} labelledBy={TITLE_ID} frameClassName="install-dialog">
      <h2 id={TITLE_ID} className="install-dialog-title">{HERO_PRIMARY_LABEL}</h2>
      <p className="install-dialog-lede">
        Three steps to a running <code className="home-code">&lt;chat&gt;</code> in your Angular app. No account, no key.
      </p>

      <ol className="install-dialog-steps">
        <li className="install-dialog-step">
          <h3 className="install-dialog-step-title">Pick how you want to start</h3>
          <div role="radiogroup" aria-label="Starting point" className="install-dialog-seg">
            {INSTALL_OPTIONS.map((o, i) => (
              <button
                key={o.key}
                ref={(el) => { radioRefs.current[i] = el; }}
                type="button"
                role="radio"
                aria-checked={o.key === variant}
                tabIndex={o.key === variant ? 0 : -1}
                className="install-dialog-seg-btn"
                onClick={() => setVariant(o.key)}
                onKeyDown={(e) => onRadioKey(e, i)}
              >
                {o.label}
              </button>
            ))}
          </div>
          <p className="install-dialog-step-note">{option.description}</p>
        </li>

        <li className="install-dialog-step">
          <h3 className="install-dialog-step-title">Run this in your Angular project</h3>
          {/* The command is one shell line, not code with meaningful line
              breaks — it wraps rather than scrolls, so the whole of it is
              visible at every width. Copy takes `option.command` from state,
              so the button still copies the single unwrapped string. */}
          <pre className="install-dialog-code install-dialog-command"><code data-testid="install-command">{option.command}</code></pre>
          <p className="install-dialog-step-note">{option.peersNote}</p>
        </li>

        <li className="install-dialog-step">
          <h3 className="install-dialog-step-title">Add the provider and the component</h3>
          <pre className="install-dialog-code"><code data-testid="install-snippet">{option.providerSnippet}</code></pre>
          <pre className="install-dialog-code"><code>{COMPONENT_SNIPPET}</code></pre>
        </li>
      </ol>

      <div className="install-dialog-footer">
        <Button
          variant="ghost"
          size="md"
          href={option.quickstartHref}
          onClick={() => trackCtaClick({ cta_id: 'hero_quickstart', adapter: option.key, track: 'developer', surface: 'home' })}
        >
          Open the full quickstart →
        </Button>
        <Button variant="primary" size="md" onClick={copy}>
          {copied ? 'Copied ✓' : 'Copy install command'}
        </Button>
      </div>
      <p className="install-dialog-trust">{HERO_TRUST_LINE}</p>
    </Modal>
  );
}
