import type { ReactNode, HTMLAttributes } from 'react';
import { tokens } from '@threadplane/design-tokens';
import { cn } from '../../lib/cn';

type Surface = 'white' | 'tinted' | 'dim';
type Padding = 'md' | 'lg';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** If true, applies a subtle hover lift via CSS. */
  hoverable?: boolean;
  /** Internal padding tier. */
  padding?: Padding;
  /** Override the surface color. */
  surface?: Surface;
}

const SURFACE: Record<Surface, string> = {
  white: tokens.surfaces.surface,
  tinted: tokens.surfaces.surfaceTinted,
  dim: tokens.surfaces.surfaceDim,
};

const PADDING: Record<Padding, string> = {
  md: '20px',
  lg: '28px',
};

export function Card({
  children,
  hoverable = false,
  padding = 'md',
  surface = 'white',
  className,
  style,
  ...rest
}: CardProps) {
  return (
    <div
      data-ui="card"
      data-hoverable={hoverable || undefined}
      className={cn(className)}
      style={{
        background: SURFACE[surface],
        border: `1px solid ${tokens.surfaces.border}`,
        borderRadius: tokens.radius.lg,
        boxShadow: tokens.shadows.sm,
        padding: PADDING[padding],
        transition: 'box-shadow 160ms ease, border-color 160ms ease, transform 160ms ease',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
