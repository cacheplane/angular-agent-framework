import type { ReactNode, HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type PillVariant = 'neutral' | 'accent' | 'angular';

interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  variant?: PillVariant;
}

export function Pill({
  children,
  variant = 'neutral',
  className,
  style,
  ...rest
}: PillProps) {
  return (
    <span
      data-ui="pill"
      data-variant={variant}
      className={cn(className)}
      style={style}
      {...rest}
    >
      {children}
    </span>
  );
}
