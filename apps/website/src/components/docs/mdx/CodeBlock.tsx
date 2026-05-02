'use client';
import { useRef, useState } from 'react';
import { analyticsEvents } from '../../../lib/analytics/events';
import { track } from '../../../lib/analytics/client';

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="5" width="9" height="9" rx="1.5" />
      <path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8.5l3.5 3.5L13 5" />
    </svg>
  );
}

export function Pre({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) {
  const ref = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const text = ref.current?.textContent ?? '';
    await navigator.clipboard.writeText(text);
    track(analyticsEvents.docsCopyCodeClick, {
      surface: 'docs',
      cta_id: 'copy_code',
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ position: 'relative', maxWidth: '100%', overflow: 'hidden' }}>
      <pre ref={ref} {...props} style={{ ...((props as Record<string, unknown>).style as React.CSSProperties), overflowX: 'auto' }}>{children}</pre>
      <button
        onClick={copy}
        aria-label={copied ? 'Copied' : 'Copy code'}
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          padding: '6px',
          borderRadius: 6,
          border: '1px solid rgba(255,255,255,0.12)',
          background: copied ? 'rgba(52,199,89,0.15)' : 'rgba(255,255,255,0.08)',
          color: copied ? '#34c759' : '#8b8fa3',
          cursor: 'pointer',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onMouseEnter={(e) => {
          if (!copied) {
            e.currentTarget.style.background = 'rgba(255,255,255,0.14)';
            e.currentTarget.style.color = '#c8c8cc';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
          }
        }}
        onMouseLeave={(e) => {
          if (!copied) {
            e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
            e.currentTarget.style.color = '#8b8fa3';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
          }
        }}>
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
    </div>
  );
}
