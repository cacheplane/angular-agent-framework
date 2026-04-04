'use client';
import { useState } from 'react';
import { tokens } from '../../../lib/design-tokens';

const CMD = 'npm install @cacheplane/stream-resource';

export function InstallStrip() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(CMD);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="inline-flex items-center gap-4 px-6 py-3 rounded-lg transition-all cursor-pointer"
      style={{
        border: `1px solid ${tokens.colors.accentBorder}`,
        background: tokens.glass.bg,
        backdropFilter: `blur(${tokens.glass.blur})`,
        WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = tokens.glow.border)}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
      onClick={copy}>
      <code className="font-mono text-sm" style={{ color: tokens.colors.textSecondary }}>{CMD}</code>
      <button className="font-mono text-xs uppercase shrink-0 transition-colors"
        style={{ color: copied ? tokens.colors.accent : tokens.colors.textMuted }}>
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}
