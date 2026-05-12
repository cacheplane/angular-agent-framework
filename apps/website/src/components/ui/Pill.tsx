import type { ReactNode, HTMLAttributes } from 'react';
import { tokens } from '@ngaf/design-tokens';
import { cn } from '../../lib/cn';

type PillVariant = 'neutral' | 'accent' | 'angular';

interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  variant?: PillVariant;
}

interface VariantStyle {
  bg: string;
  border: string;
  color: string;
}

const VARIANT_STYLES: Record<PillVariant, VariantStyle> = {
  neutral: {
    bg: tokens.surfaces.surface,
    border: tokens.surfaces.border,
    color: tokens.colors.textSecondary,
  },
  accent: {
    bg: tokens.colors.accentSurface,
    border: tokens.colors.accentBorder,
    color: tokens.colors.accent,
  },
  angular: {
    bg: 'rgba(221, 0, 49, 0.06)',
    border: 'rgba(221, 0, 49, 0.18)',
    color: tokens.colors.angularRed,
  },
};

export function Pill({
  children,
  variant = 'neutral',
  className,
  style,
  ...rest
}: PillProps) {
  const v = VARIANT_STYLES[variant];
  return (
    <span
      data-ui="pill"
      data-variant={variant}
      className={cn(className)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: tokens.typography.fontMono,
        fontSize: 11,
        fontWeight: 500,
        padding: '4px 10px',
        borderRadius: tokens.radius.full,
        background: v.bg,
        border: `1px solid ${v.border}`,
        color: v.color,
        lineHeight: 1.4,
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
