// SPDX-License-Identifier: MIT
import type { ReactNode } from 'react';
import { Section } from '../ui/Section';
import { Container } from '../ui/Container';
import { SectionHeader } from '../ui/SectionHeader';

interface DiagramSectionProps {
  id: string;
  eyebrow: string;
  headline: string;
  body: ReactNode;
  children: ReactNode;
}

/**
 * A landing section framing any kit diagram with a centered header + body.
 * The `.stack-diagram-*` classes predate the generalization and are shared.
 */
export function DiagramSection({ id, eyebrow, headline, body, children }: DiagramSectionProps) {
  return (
    <Section surface="tinted" id={id} ariaLabelledBy={`${id}-heading`}>
      <Container>
        <div className="stack-diagram-section">
          <SectionHeader
            variant="centered"
            eyebrow={eyebrow}
            heading={headline}
            headingId={`${id}-heading`}
          />
          <p className="stack-diagram-body">{body}</p>
          {children}
        </div>
      </Container>
    </Section>
  );
}
