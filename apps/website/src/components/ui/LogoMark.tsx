import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type LogoSize = 'sm' | 'md';

interface LogoMarkProps extends HTMLAttributes<HTMLSpanElement> {
  size?: LogoSize;
  /** Hide the wordmark, show only the icon. */
  iconOnly?: boolean;
}

export function LogoMark({
  size = 'md',
  iconOnly = false,
  className,
  style,
  ...rest
}: LogoMarkProps) {
  return (
    <span
      data-ui="logo-mark"
      data-size={size}
      className={cn(className)}
      style={style}
      {...rest}
    >
      <span aria-hidden="true" data-ui="logo-mark-icon">🛩️</span>
      {iconOnly ? null : <span>Threadplane</span>}
    </span>
  );
}
