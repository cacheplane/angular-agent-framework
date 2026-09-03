import type { ReactNode } from 'react';
import { DiagramSection } from './DiagramSection';
import { StackDiagram, type StackHighlight } from '../docs/diagrams';

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
    <DiagramSection id={id} eyebrow={eyebrow} headline={headline} body={body}>
      <StackDiagram highlight={highlight} caption={caption} scale="marketing" />
    </DiagramSection>
  );
}
