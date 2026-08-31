import type { ReactNode, HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type Surface = 'canvas' | 'tinted' | 'white' | 'dark';

interface SectionProps extends Omit<HTMLAttributes<HTMLElement>, 'id'> {
  children: ReactNode;
  /** Background surface for this section. Defaults to canvas (page bg). */
  surface?: Surface;
  /** Use the tighter vertical rhythm (proof strip, final CTA). */
  tight?: boolean;
  /** HTML element ID — useful for in-page anchors. */
  id?: string;
  /** Optional aria-labelledby pointing at a heading inside the section. */
  ariaLabelledBy?: string;
}

export function Section({
  children,
  surface = 'canvas',
  tight = false,
  id,
  ariaLabelledBy,
  className,
  style,
  ...rest
}: SectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={ariaLabelledBy}
      data-ui="section"
      data-surface={surface}
      data-tight={tight || undefined}
      className={cn(className)}
      style={style}
      {...rest}
    >
      {children}
    </section>
  );
}
