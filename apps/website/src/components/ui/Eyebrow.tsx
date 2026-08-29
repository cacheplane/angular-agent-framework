import type { ReactNode, HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type Tone = 'muted' | 'accent' | 'angular';

interface EyebrowProps extends HTMLAttributes<HTMLParagraphElement> {
  children: ReactNode;
  /** Optional color override. Defaults to muted neutral. */
  tone?: Tone;
}

export function Eyebrow({
  children,
  tone = 'muted',
  className,
  style,
  ...rest
}: EyebrowProps) {
  return (
    <p
      data-ui="eyebrow"
      data-tone={tone}
      className={cn(className)}
      style={style}
      {...rest}
    >
      {children}
    </p>
  );
}
