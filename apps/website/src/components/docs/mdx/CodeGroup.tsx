'use client';
import { useState, Children, isValidElement } from 'react';
import { tokens } from '@ngaf/design-tokens';

export function CodeGroup({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(0);
  const blocks = Children.toArray(children).filter(isValidElement);

  const titles = blocks.map((block, i) => {
    const pre = block as React.ReactElement<{ 'data-title'?: string }>;
    return pre.props['data-title'] ?? `File ${i + 1}`;
  });

  return (
    <div style={{
      borderRadius: 12,
      border: `1px solid ${tokens.glass.border}`,
      boxShadow: tokens.glass.shadow,
      overflow: 'hidden',
      marginBottom: 16,
    }}>
      <div style={{
        display: 'flex', gap: 0,
        background: 'rgba(26, 27, 38, 0.95)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        {titles.map((title, i) => (
          <button
            key={title}
            onClick={() => setActive(i)}
            style={{
              padding: '8px 14px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.7rem',
              color: active === i ? '#a9b1d6' : '#4A527A',
              background: active === i ? 'rgba(255,255,255,0.05)' : 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}>
            {title}
          </button>
        ))}
      </div>
      <div>{blocks[active]}</div>
    </div>
  );
}
