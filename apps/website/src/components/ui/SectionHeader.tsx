import type { ReactNode } from 'react';
import { Eyebrow } from './Eyebrow';

type Variant = 'centered' | 'rail';

interface SectionHeaderProps {
  eyebrow: string;
  heading: ReactNode;
  /** id for the h2, for Section's ariaLabelledBy. */
  headingId?: string;
  /** Italic muted aside under the heading (rail variant). */
  aside?: ReactNode;
  /**
   * 'centered' — the classic kicker/H2 stack.
   * 'rail' — left-rail editorial variant (treatment C): kicker over a 2px
   * rule, heading below, italic aside. The PARENT owns the grid placement;
   * this component only renders the header block.
   */
  variant?: Variant;
}

export function SectionHeader({
  eyebrow,
  heading,
  headingId,
  aside,
  variant = 'centered',
}: SectionHeaderProps) {
  return (
    <header data-ui="section-header" data-variant={variant}>
      <Eyebrow tone="accent" className="section-header-eyebrow">
        {eyebrow}
      </Eyebrow>
      <h2 id={headingId} className="section-header-heading">
        {heading}
      </h2>
      {aside ? <p className="section-header-aside">{aside}</p> : null}
    </header>
  );
}
