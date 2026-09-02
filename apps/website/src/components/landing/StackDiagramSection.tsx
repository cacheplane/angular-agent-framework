// SPDX-License-Identifier: MIT
import type { ReactNode } from 'react';
import { Section } from '../ui/Section';
import { Container } from '../ui/Container';
import { Eyebrow } from '../ui/Eyebrow';
import { StackDiagram, type StackHighlight } from '../docs/diagrams/StackDiagram';

interface StackDiagramSectionProps {
  id: string;
  eyebrow: string;
  headline: string;
  body: ReactNode;
  highlight?: StackHighlight;
  caption?: string;
}

/**
 * Homepage architecture section: the canonical stack diagram, widened to the
 * marketing scale, framed by a headline + body in the site's landing idiom.
 */
export function StackDiagramSection({
  id,
  eyebrow,
  headline,
  body,
  highlight = 'none',
  caption,
}: StackDiagramSectionProps) {
  return (
    <Section surface="tinted" id={id} ariaLabelledBy={`${id}-heading`}>
      <Container>
        <div className="stack-diagram-section">
          <Eyebrow tone="accent" className="stack-diagram-eyebrow">
            {eyebrow}
          </Eyebrow>
          <h2 id={`${id}-heading`} className="stack-diagram-headline">
            {headline}
          </h2>
          <p className="stack-diagram-body">{body}</p>
          <StackDiagram highlight={highlight} caption={caption} scale="marketing" />
        </div>
      </Container>
    </Section>
  );
}
