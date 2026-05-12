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
      borderRadius: tokens.radius.md,
      overflow: 'hidden',
      marginBottom: 16,
    }}>
      {/* Tab bar — same treatment as Tabs */}
      <div style={{
        display: 'flex',
        gap: 0,
        background: tokens.surfaces.surface,
        border: `1px solid ${tokens.surfaces.border}`,
        borderBottom: `1px solid ${tokens.surfaces.border}`,
        borderRadius: `${tokens.radius.md} ${tokens.radius.md} 0 0`,
      }}>
        {titles.map((title, i) => (
          <button
            key={title}
            onClick={() => setActive(i)}
            style={{
              padding: '8px 14px',
              fontFamily: tokens.typography.fontMono,
              fontSize: '0.7rem',
              fontWeight: active === i ? 600 : 400,
              color: active === i ? tokens.colors.accent : tokens.colors.textSecondary,
              background: 'transparent',
              border: 'none',
              borderBottom: active === i ? `2px solid ${tokens.colors.accent}` : '2px solid transparent',
              cursor: 'pointer',
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={(e) => {
              if (i !== active) e.currentTarget.style.color = tokens.colors.textPrimary;
            }}
            onMouseLeave={(e) => {
              if (i !== active) e.currentTarget.style.color = tokens.colors.textSecondary;
            }}
          >
            {title}
          </button>
        ))}
      </div>
      {/* Active code block container — code body stays dark (tokyo-night) */}
      <div style={{
        border: `1px solid ${tokens.surfaces.border}`,
        borderTop: 'none',
        borderRadius: `0 0 ${tokens.radius.md} ${tokens.radius.md}`,
        overflow: 'hidden',
      }}>
        {blocks[active]}
      </div>
    </div>
  );
}
