'use client';
import { useState } from 'react';
import { tokens } from '@ngaf/design-tokens';
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

  const isHero = variant === 'hero';

  return (
    <button
      onClick={handleClick}
      aria-label={copied ? 'Prompt copied' : 'Copy prompt'}
      style={{
        background: isHero ? tokens.colors.accent : tokens.surfaces.surface,
        border: isHero ? 'none' : `1px solid ${tokens.surfaces.border}`,
        color: isHero ? '#fff' : (copied ? tokens.colors.accent : tokens.colors.textSecondary),
        fontFamily: 'var(--font-mono)',
        fontSize: isHero ? '13px' : '12px',
        padding: isHero ? '12px 24px' : '8px 16px',
        borderRadius: isHero ? '8px' : '6px',
        cursor: 'pointer',
        transition: 'box-shadow 0.2s, border-color 0.2s, background 0.2s',
      }}
      onMouseEnter={(e) => {
        if (!isHero) {
          e.currentTarget.style.borderColor = tokens.surfaces.borderStrong;
          e.currentTarget.style.background = tokens.colors.accentSurface;
        }
      }}
      onMouseLeave={(e) => {
        if (!isHero) {
          e.currentTarget.style.borderColor = tokens.surfaces.border;
          e.currentTarget.style.background = tokens.surfaces.surface;
        }
      }}>
      <span aria-hidden="true">{copied ? '\u2713' : '\u26A1'}</span>{' '}
      {copied ? 'Copied!' : (label ?? 'Copy prompt')}
    </button>
  );
}
