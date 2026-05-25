import type { HTMLAttributes } from 'react';
import { tokens } from '@threadplane/design-tokens';
import { cn } from '../../lib/cn';

type LogoSize = 'sm' | 'md';

interface LogoMarkProps extends HTMLAttributes<HTMLSpanElement> {
  size?: LogoSize;
  /** Hide the wordmark, show only the icon. */
  iconOnly?: boolean;
}

const SIZE: Record<LogoSize, { icon: number; label: number }> = {
  sm: { icon: 18, label: 14 },
  md: { icon: 22, label: 16 },
};

export function LogoMark({
  size = 'md',
  iconOnly = false,
  className,
  style,
  ...rest
}: LogoMarkProps) {
  const s = SIZE[size];
  return (
    <span
      data-ui="logo-mark"
      className={cn(className)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontFamily: tokens.typography.fontSerif,
        fontSize: s.label,
        fontWeight: 700,
        color: tokens.colors.textPrimary,
        lineHeight: 1,
        ...style,
      }}
      {...rest}
    >
      <span aria-hidden="true" style={{ fontSize: s.icon, lineHeight: 1 }}>🛩️</span>
      {iconOnly ? null : <span>Threadplane</span>}
    </span>
  );
}
