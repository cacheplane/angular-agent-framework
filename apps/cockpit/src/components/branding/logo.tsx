import React from 'react';
import type { HTMLAttributes } from 'react';

export function Logo({ className, style, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      data-ui="cockpit-logo"
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', lineHeight: 1, ...style }}
      {...rest}
    >
      <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1 }}>🛩️</span>
      <span style={{ fontFamily: 'var(--font-garamond), "EB Garamond", Georgia, serif', fontSize: 16, fontWeight: 600, color: 'var(--ds-text-primary)' }}>
        Threadplane
      </span>
      <span style={{ fontFamily: 'var(--font-mono), "JetBrains Mono", monospace', fontSize: 12, color: 'var(--ds-text-muted)' }}>
        cockpit
      </span>
    </span>
  );
}
