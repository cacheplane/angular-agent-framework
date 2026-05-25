import type { ReactNode } from 'react';
import { tokens } from '@threadplane/design-tokens';

type CalloutType = 'tip' | 'warning' | 'info' | 'danger';

interface Props {
  type?: CalloutType;
  title?: string;
  children: ReactNode;
}

const TONE: Record<CalloutType, { stripe: string; icon: string }> = {
  tip: { stripe: '#1a7a40', icon: '✓' },
  warning: { stripe: '#D4850F', icon: '!' },
  info: { stripe: tokens.colors.accent, icon: 'i' },
  danger: { stripe: tokens.colors.angularRed, icon: '✕' },
};

export function Callout({ type = 'info', title, children }: Props) {
  const tone = TONE[type];
  return (
    <div
      data-mdx="callout"
      data-tone={type}
      style={{
        position: 'relative',
        background: tokens.surfaces.surfaceTinted,
        border: `1px solid ${tokens.surfaces.border}`,
        borderLeft: `4px solid ${tone.stripe}`,
        borderRadius: tokens.radius.md,
        padding: '14px 18px 14px 22px',
        margin: '20px 0',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: title ? 6 : 0 }}>
        <span
          aria-hidden="true"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 20,
            height: 20,
            borderRadius: tokens.radius.full,
            background: tone.stripe,
            color: tokens.colors.textInverted,
            fontFamily: tokens.typography.fontMono,
            fontSize: 11,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {tone.icon}
        </span>
        {title ? (
          <strong
            style={{
              fontFamily: tokens.typography.fontSans,
              fontSize: 15,
              color: tokens.colors.textPrimary,
              fontWeight: 600,
            }}
          >
            {title}
          </strong>
        ) : null}
      </div>
      <div
        style={{
          fontFamily: tokens.typography.body.family,
          fontSize: 15,
          lineHeight: 1.6,
          color: tokens.colors.textSecondary,
        }}
      >
        {children}
      </div>
    </div>
  );
}
