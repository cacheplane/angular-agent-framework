'use client';
import { useState } from 'react';
import { tokens } from '@threadplane/design-tokens';
import { analyticsEvents } from '../../lib/analytics/events';
import { track } from '../../lib/analytics/client';

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="5" width="9" height="9" rx="1.5" />
      <path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8.5l3.5 3.5L13 5" />
    </svg>
  );
}

interface Props {
  /** The exact string copied to the clipboard. */
  text: string;
}

export function CopyButton({ text }: Props) {
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(text);
      track(analyticsEvents.docsCopyCodeClick, {
        surface: 'docs',
        cta_id: 'copy_install',
      });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard access denied — silently ignore
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={copied ? 'Copied' : 'Copy install command'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        flex: '0 0 auto',
        padding: 0,
        border: `1px solid ${tokens.surfaces.border}`,
        borderRadius: tokens.radius.sm,
        background: tokens.surfaces.surface,
        color: copied ? tokens.colors.accent : tokens.colors.textMuted,
        cursor: 'pointer',
        transition: 'color 0.15s, border-color 0.15s, background 0.15s',
      }}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}
