'use client';
import { useState, Children, isValidElement } from 'react';
import { tokens } from '@ngaf/design-tokens';

interface TabProps {
  label?: string;
  children: React.ReactNode;
}

export function Tabs({ items, children }: { items?: string[]; children: React.ReactNode }) {
  const [active, setActive] = useState(0);
  const tabs = Children.toArray(children);

  // Extract labels: from items prop, from Tab label prop, or fallback
  const labels = items ?? tabs.map((child, i) => {
    if (isValidElement<TabProps>(child) && child.props.label) {
      return child.props.label;
    }
    return `Tab ${i + 1}`;
  });

  return (
    <div style={{ marginTop: 16, marginBottom: 20 }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex',
        gap: 0,
        background: tokens.surfaces.surface,
        borderBottom: `1px solid ${tokens.surfaces.border}`,
      }}>
        {labels.map((label, i) => (
          <button
            key={label}
            onClick={() => setActive(i)}
            style={{
              padding: '10px 18px',
              fontFamily: tokens.typography.fontMono,
              fontSize: '0.8rem',
              fontWeight: active === i ? 600 : 400,
              color: active === i ? tokens.colors.accent : tokens.colors.textSecondary,
              background: 'transparent',
              border: 'none',
              borderBottom: active === i ? `2px solid ${tokens.colors.accent}` : '2px solid transparent',
              cursor: 'pointer',
              transition: 'color 0.15s, border-color 0.15s',
              borderRadius: '6px 6px 0 0',
            }}
            onMouseEnter={(e) => {
              if (i !== active) e.currentTarget.style.color = tokens.colors.textPrimary;
            }}
            onMouseLeave={(e) => {
              if (i !== active) e.currentTarget.style.color = tokens.colors.textSecondary;
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {/* Tab body */}
      <div style={{
        background: tokens.surfaces.surface,
        border: `1px solid ${tokens.surfaces.border}`,
        borderTop: 'none',
        borderRadius: `0 0 ${tokens.radius.md} ${tokens.radius.md}`,
      }}>
        {tabs[active]}
      </div>
    </div>
  );
}

export function Tab({ children }: TabProps) {
  return <div>{children}</div>;
}
