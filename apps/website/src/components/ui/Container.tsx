import type { ReactNode, HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Wider variant for full-width hero collages */
  size?: 'default' | 'wide';
}

export function Container({
  children,
  size = 'default',
  className,
  style,
  ...rest
}: ContainerProps) {
  return (
    <div
      data-ui="container"
      data-size={size}
      className={cn(className)}
      style={style}
      {...rest}
    >
      {children}
    </div>
  );
}
