import type { ReactNode, HTMLAttributes } from 'react';
import { tokens } from '@ngaf/design-tokens';
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
  const maxWidth = size === 'wide' ? '1320px' : tokens.space.containerMax;
  return (
    <div
      data-ui="container"
      data-size={size}
      className={cn(className)}
      style={{
        width: '100%',
        maxWidth,
        margin: '0 auto',
        paddingLeft: tokens.space.containerX,
        paddingRight: tokens.space.containerX,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
