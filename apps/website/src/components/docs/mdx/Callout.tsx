import { tokens } from '../../../../lib/design-tokens';

const CALLOUT_STYLES = {
  info: {
    accent: tokens.colors.accent,
    bg: 'rgba(0, 64, 144, 0.04)',
    glassBg: 'rgba(0, 64, 144, 0.06)',
    glow: '0 0 20px rgba(0, 64, 144, 0.06)',
    iconBg: 'rgba(0, 64, 144, 0.1)',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 1a7 7 0 110 14A7 7 0 018 1zm0 3a.75.75 0 00-.75.75v4.5a.75.75 0 001.5 0v-4.5A.75.75 0 008 4zm0 8a.75.75 0 100-1.5.75.75 0 000 1.5z"/>
      </svg>
    ),
  },
  warning: {
    accent: '#e8930c',
    bg: 'rgba(232, 147, 12, 0.04)',
    glassBg: 'rgba(232, 147, 12, 0.06)',
    glow: '0 0 20px rgba(232, 147, 12, 0.06)',
    iconBg: 'rgba(232, 147, 12, 0.1)',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8.982 1.566a1.13 1.13 0 00-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 018 5zm0 8a.75.75 0 100-1.5.75.75 0 000 1.5z"/>
      </svg>
    ),
  },
  tip: {
    accent: '#10b981',
    bg: 'rgba(16, 185, 129, 0.04)',
    glassBg: 'rgba(16, 185, 129, 0.06)',
    glow: '0 0 20px rgba(16, 185, 129, 0.06)',
    iconBg: 'rgba(16, 185, 129, 0.1)',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 1.5a4.5 4.5 0 00-1.68 8.68.5.5 0 01.3.46v1.86a1 1 0 001 1h.76a1 1 0 001-1v-1.86a.5.5 0 01.3-.46A4.5 4.5 0 008 1.5zM6.5 13.5h3v.5a1 1 0 01-1 1h-1a1 1 0 01-1-1v-.5z"/>
      </svg>
    ),
  },
  danger: {
    accent: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.04)',
    glassBg: 'rgba(239, 68, 68, 0.06)',
    glow: '0 0 20px rgba(239, 68, 68, 0.06)',
    iconBg: 'rgba(239, 68, 68, 0.1)',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 1a7 7 0 110 14A7 7 0 018 1zm2.47 4.47a.75.75 0 00-1.06 0L8 6.94 6.59 5.47a.75.75 0 10-1.06 1.06L6.94 8 5.47 9.41a.75.75 0 101.06 1.06L8 9.06l1.41 1.41a.75.75 0 101.06-1.06L9.06 8l1.41-1.47a.75.75 0 000-1.06z"/>
      </svg>
    ),
  },
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
      padding: '16px 20px',
      borderRadius: 12,
      background: s.bg,
      backdropFilter: `blur(${tokens.glass.blur})`,
      WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
      border: `1px solid ${s.glassBg}`,
      boxShadow: s.glow,
      marginTop: 20,
      marginBottom: 24,
      position: 'relative',
    }}>
      {title && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          marginBottom: 8,
        }}>
          <div style={{
            width: 24, height: 24, borderRadius: 6,
            background: s.iconBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: s.accent,
            flexShrink: 0,
          }}>
            {s.icon}
          </div>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
            fontWeight: 600,
            color: s.accent,
            letterSpacing: '0.01em',
          }}>{title}</span>
        </div>
      )}
      <div style={{
        fontSize: '0.875rem',
        color: tokens.colors.textSecondary,
        lineHeight: 1.7,
        paddingLeft: title ? 32 : 0,
      }}>
        {children}
      </div>
    </div>
  );
}
