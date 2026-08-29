import type { ReactNode } from 'react';
import Link from 'next/link';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import { Card } from '../ui/Card';

export interface FeatureBlockProps {
  eyebrow: string;
  headline: string;
  body: ReactNode;
  bullets: string[];
  supportingCards: { title: string; description: string }[];
  cta: { label: string; href: string };
  visual: ReactNode;
  /** If true, visual on the left; text on the right. Used to alternate sections. */
  visualLeft?: boolean;
  /** Section surface — defaults to canvas. */
  surface?: 'canvas' | 'tinted' | 'white';
  /** Anchor id + aria-labelledby target. */
  id?: string;
}

export function FeatureBlock({
  eyebrow,
  headline,
  body,
  bullets,
  supportingCards,
  cta,
  visual,
  visualLeft = false,
  surface = 'canvas',
  id,
}: FeatureBlockProps) {
  const headingId = id ? `${id}-heading` : undefined;
  return (
    <Section surface={surface} id={id} ariaLabelledBy={headingId}>
      <Container>
        <div className="feature-block-grid" data-visual-left={visualLeft || undefined}>
          {/* Text column */}
          <div className="feature-block-text">
            <Eyebrow tone="accent" className="feature-block-eyebrow">{eyebrow}</Eyebrow>
            <h2 id={headingId} className="feature-block-heading">
              {headline}
            </h2>
            <p className="feature-block-body">
              {body}
            </p>
            <ul className="feature-block-bullets">
              {bullets.map((b) => (
                <li key={b} className="feature-block-bullet">
                  <span aria-hidden="true" className="feature-block-bullet-check">
                    ✓
                  </span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            {/* Supporting card row */}
            <div className="feature-block-card-row">
              {supportingCards.map((sc) => (
                <Card key={sc.title} padding="md" surface="tinted">
                  <div className="feature-block-card-title">
                    {sc.title}
                  </div>
                  <div className="feature-block-card-desc">
                    {sc.description}
                  </div>
                </Card>
              ))}
            </div>

            <Link href={cta.href} className="feature-block-cta">
              {cta.label} →
            </Link>
          </div>

          {/* Visual column */}
          <div className="feature-block-visual">{visual}</div>
        </div>
      </Container>
    </Section>
  );
}
