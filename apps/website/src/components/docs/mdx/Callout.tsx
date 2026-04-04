import { tokens } from '../../../../lib/design-tokens';

const CALLOUT_STYLES = {
  info: { border: tokens.colors.accent, bg: 'rgba(0, 64, 144, 0.04)' },
  warning: { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.04)' },
  tip: { border: '#22c55e', bg: 'rgba(34, 197, 94, 0.04)' },
  danger: { border: '#ef4444', bg: 'rgba(239, 68, 68, 0.04)' },
} as const;

interface Props {
  type?: keyof typeof CALLOUT_STYLES;
  title?: string;
  children: React.ReactNode;
}

export function Callout({ type = 'info', title, children }: Props) {
  const style = CALLOUT_STYLES[type];
  return (
    <div style={{
      padding: '12px 16px',
      borderRadius: 8,
      borderLeft: `3px solid ${style.border}`,
      background: style.bg,
      marginBottom: 16,
    }}>
      {title && (
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.8rem',
          fontWeight: 600,
          color: style.border,
          marginBottom: 4,
        }}>{title}</div>
      )}
      <div style={{ fontSize: '0.875rem', color: tokens.colors.textSecondary, lineHeight: 1.6 }}>
        {children}
      </div>
    </div>
  );
}
