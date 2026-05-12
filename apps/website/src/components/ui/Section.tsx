import type { ReactNode, HTMLAttributes } from 'react';
import { tokens } from '@ngaf/design-tokens';
import { cn } from '../../lib/cn';

type Surface = 'canvas' | 'tinted' | 'white';

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

const SURFACE_BG: Record<Surface, string> = {
  canvas: tokens.surfaces.canvas,
  tinted: tokens.surfaces.surfaceTinted,
  white: tokens.surfaces.surface,
};

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
      className={cn(className)}
      style={{
        background: SURFACE_BG[surface],
        paddingTop: tight ? tokens.space.sectionYTight : tokens.space.sectionY,
        paddingBottom: tight ? tokens.space.sectionYTight : tokens.space.sectionY,
        ...style,
      }}
      {...rest}
    >
      {children}
    </section>
  );
}
