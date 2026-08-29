'use client';
import { useState } from 'react';
import { analyticsEvents } from '../../lib/analytics/events';
import { track } from '../../lib/analytics/client';

interface Props {
  prompt: string;
  variant?: 'hero' | 'docs';
  label?: `copy_${string}`;
}

export function CopyPromptButton({ prompt, variant = 'docs', label }: Props) {
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      track(analyticsEvents.docsCopyPromptClick, {
        surface: variant === 'hero' ? 'home' : 'docs',
        cta_id: label ?? 'copy_prompt',
      });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard access denied — silently ignore
    }
  };

  return (
    <button
      onClick={handleClick}
      aria-label={copied ? 'Prompt copied' : 'Copy prompt'}
      className="docs-copy-prompt-button"
      data-variant={variant}
      data-copied={copied || undefined}>
      <span aria-hidden="true">{copied ? '\u2713' : '\u26A1'}</span>{' '}
      {copied ? 'Copied!' : (label ?? 'Copy prompt')}
    </button>
  );
}
