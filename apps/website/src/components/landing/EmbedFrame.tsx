'use client';
import { useState } from 'react';
import { tokens } from '@ngaf/design-tokens';

interface EmbedFrameProps {
  src: string;
  title: string;
  height?: number;
}

function ExpandIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2H2v4M14 10v4h-4M2 2l5 5M14 14l-5-5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}

export function EmbedFrame({ src, title, height = 400 }: EmbedFrameProps) {
  const [fullscreen, setFullscreen] = useState(false);

  if (fullscreen) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'rgba(255,255,255,0.06)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}>
          <span style={{
            fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500,
            color: 'rgba(255,255,255,0.8)',
          }}>
            {title}
          </span>
          <button
            onClick={() => setFullscreen(false)}
            aria-label="Close fullscreen"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.6)', padding: 4,
            }}
          >
            <CloseIcon />
          </button>
        </div>
        <iframe
          src={src}
          title={title}
          style={{ flex: 1, width: '100%', border: 'none', background: '#fff' }}
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        borderTop: `1px solid ${tokens.glass.border}`,
        background: 'rgba(0,0,0,0.02)',
        margin: '0 -32px',
      }}
        className="embed-frame-mobile"
      >
        <iframe
          src={src}
          title={title}
          style={{ width: '100%', height, border: 'none', display: 'block' }}
          loading="lazy"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
      <button
        onClick={() => setFullscreen(true)}
        aria-label="Expand to fullscreen"
        style={{
          position: 'absolute', top: 8, right: -24,
          background: 'rgba(255,255,255,0.9)',
          border: `1px solid ${tokens.glass.border}`,
          borderRadius: 6, padding: '6px',
          cursor: 'pointer', color: tokens.colors.textMuted,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <ExpandIcon />
      </button>
      <style>{`
        @media (min-width: 768px) {
          .embed-frame-mobile { margin: 0 !important; }
        }
      `}</style>
    </div>
  );
}
