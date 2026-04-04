import { tokens } from '../../../../lib/design-tokens';

const CALLOUT_STYLES = {
  info: { border: tokens.colors.accent, bg: 'rgba(0, 64, 144, 0.05)', icon: 'ℹ️' },
  warning: { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.05)', icon: '⚠️' },
  tip: { border: '#22c55e', bg: 'rgba(34, 197, 94, 0.05)', icon: '💡' },
  danger: { border: '#ef4444', bg: 'rgba(239, 68, 68, 0.05)', icon: '🚫' },
} as const;

interface Props {
  type?: keyof typeof CALLOUT_STYLES;
  title?: string;
  children: React.ReactNode;
}

export function Callout({ type = 'info', title, children }: Props) {
  const s = CALLOUT_STYLES[type];
  return (
    <div style={{
      padding: '14px 18px',
      borderRadius: 10,
      borderLeft: `3px solid ${s.border}`,
      background: s.bg,
      marginTop: 16,
      marginBottom: 20,
    }}>
      {title && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontFamily: 'var(--font-mono)',
          fontSize: '0.8rem',
          fontWeight: 600,
          color: s.border,
          marginBottom: 6,
        }}>
          <span style={{ fontSize: '0.9rem' }}>{s.icon}</span>
          {title}
        </div>
      )}
      <div style={{ fontSize: '0.875rem', color: tokens.colors.textSecondary, lineHeight: 1.7 }}>
        {children}
      </div>
    </div>
  );
}
