'use client';

import { useState, useRef, useEffect } from 'react';
import { tokens } from '../../../lib/design-tokens';

export interface Citation {
  source: string;
  url: string;
  stat?: string;
  note: string;
}

interface CitationBadgeProps {
  citation: Citation;
}

export function CitationBadge({ citation }: CitationBadgeProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <span
      ref={ref}
      style={{ position: 'relative', display: 'inline-block', verticalAlign: 'super', marginLeft: 3 }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`View citation: ${citation.source}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        style={{
          width: 13,
          height: 13,
          borderRadius: '50%',
          background: 'transparent',
          border: `1px solid ${open ? 'rgba(0,64,144,0.45)' : 'rgba(0,64,144,0.2)'}`,
          color: open ? 'rgba(0,64,144,0.7)' : 'rgba(0,64,144,0.35)',
          fontSize: 7,
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 700,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
          padding: 0,
          transition: 'border-color 0.15s ease, color 0.15s ease',
          flexShrink: 0,
        }}
      >
        i
      </button>

      {open && (
        <span
          role="dialog"
          aria-label={`Citation: ${citation.source}`}
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 10px)',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 288,
            background: '#ffffff',
            border: `1px solid ${tokens.colors.accentBorder}`,
            borderRadius: 10,
            padding: '14px 16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)',
            zIndex: 200,
            textAlign: 'left',
            display: 'block',
          }}
        >
          {/* Arrow */}
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              bottom: -5,
              left: '50%',
              transform: 'translateX(-50%) rotate(45deg)',
              width: 8,
              height: 8,
              background: '#ffffff',
              borderRight: `1px solid ${tokens.colors.accentBorder}`,
              borderBottom: `1px solid ${tokens.colors.accentBorder}`,
              display: 'block',
            }}
          />

          <p style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.07em',
            color: tokens.colors.accent,
            margin: '0 0 5px',
            fontWeight: 700,
          }}>
            Source
          </p>

          <p style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 13,
            fontWeight: 600,
            color: tokens.colors.textPrimary,
            margin: '0 0 5px',
            lineHeight: 1.4,
          }}>
            {citation.source}
          </p>

          {citation.stat && (
            <p style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 12,
              color: tokens.colors.textSecondary,
              margin: '0 0 6px',
              lineHeight: 1.5,
            }}>
              {citation.stat}
            </p>
          )}

          <p style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 12,
            color: tokens.colors.textMuted,
            margin: '0 0 10px',
            lineHeight: 1.5,
          }}>
            {citation.note}
          </p>

          <a
            href={citation.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              color: tokens.colors.accent,
              textDecoration: 'none',
              letterSpacing: '0.02em',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
          >
            View source →
          </a>
        </span>
      )}
    </span>
  );
}
