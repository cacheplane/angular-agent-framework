import type { ReactNode, HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type Surface = 'white' | 'tinted' | 'dim';
type Padding = 'md' | 'lg';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** If true, applies a subtle hover lift (border + shadow + translate) via CSS. */
  hoverable?: boolean;
  /**
   * If true, renders an accent-tinted surface + border, and — when hoverable —
   * the hover lift uses an accent ring instead of the neutral border treatment.
   */
  accent?: boolean;
  /** Internal padding tier. */
  padding?: Padding;
  /** Override the surface color. */
  surface?: Surface;
}

export function Card({
  children,
  hoverable = false,
  accent = false,
  padding = 'md',
  surface = 'white',
  className,
  style,
  ...rest
}: CardProps) {
  // Resting background / border / shadow / radius / padding live in the
  // `[data-ui="card"]` stylesheet (apps/website/src/styles/ui.css) — never
  // inline — so the :hover rules can actually override border-color and
  // box-shadow. Inline styles beat any stylesheet :hover rule, which
  // previously left the lift rendering only the transform.
  return (
    <div
      data-ui="card"
      data-hoverable={hoverable || undefined}
      data-accent={accent || undefined}
      data-surface={surface !== 'white' ? surface : undefined}
      data-padding={padding !== 'md' ? padding : undefined}
      className={cn(className)}
      style={style}
      {...rest}
    >
      {children}
    </div>
  );
}
