'use client';
import { useState, Children } from 'react';
import { tokens } from '../../../../lib/design-tokens';

export function Tabs({ items, children }: { items?: string[]; children: React.ReactNode }) {
  const [active, setActive] = useState(0);
  const tabs = Children.toArray(children);
  const labels = items ?? tabs.map((_, i) => `Tab ${i + 1}`);

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        display: 'flex', gap: 0,
        borderBottom: `1px solid ${tokens.colors.accentBorder}`,
      }}>
        {labels.map((label, i) => (
          <button
            key={label}
            onClick={() => setActive(i)}
            style={{
              padding: '8px 16px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              fontWeight: active === i ? 500 : 400,
              color: active === i ? tokens.colors.accent : tokens.colors.textMuted,
              background: 'none',
              border: 'none',
              borderBottom: active === i ? `2px solid ${tokens.colors.accent}` : '2px solid transparent',
              cursor: 'pointer',
              transition: 'color 0.15s',
            }}>
            {label}
          </button>
        ))}
      </div>
      <div>{tabs[active]}</div>
    </div>
  );
}

export function Tab({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}
