import type { ReactNode } from 'react';
import Link from 'next/link';
import { tokens } from '@threadplane/design-tokens';
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
        <div
          className="feature-block-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: 64,
            alignItems: 'center',
          }}
        >
          {/* Text column */}
          <div style={{ order: visualLeft ? 2 : 1 }}>
            <Eyebrow tone="accent" style={{ marginBottom: 16 }}>{eyebrow}</Eyebrow>
            <h2
              id={headingId}
              style={{
                fontFamily: tokens.typography.h2.family,
                fontSize: tokens.typography.h2.size,
                lineHeight: tokens.typography.h2.line,
                fontWeight: 700,
                color: tokens.colors.textPrimary,
                margin: 0,
                marginBottom: 20,
                letterSpacing: '-0.015em',
              }}
            >
              {headline}
            </h2>
            <p
              style={{
                fontFamily: tokens.typography.bodyLg.family,
                fontSize: tokens.typography.bodyLg.size,
                lineHeight: tokens.typography.bodyLg.line,
                color: tokens.colors.textSecondary,
                margin: 0,
                marginBottom: 24,
              }}
            >
              {body}
            </p>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: '0 0 32px 0',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              {bullets.map((b) => (
                <li
                  key={b}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    fontFamily: tokens.typography.body.family,
                    fontSize: tokens.typography.body.size,
                    lineHeight: tokens.typography.body.line,
                    color: tokens.colors.textPrimary,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      flex: '0 0 18px',
                      height: 18,
                      marginTop: 4,
                      borderRadius: tokens.radius.full,
                      background: tokens.colors.accentSurface,
                      border: `1px solid ${tokens.colors.accentBorder}`,
                      color: tokens.colors.accent,
                      fontSize: 11,
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 1,
                    }}
                  >
                    ✓
                  </span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            {/* Supporting card row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: 8,
                marginBottom: 24,
              }}
            >
              {supportingCards.map((sc) => (
                <Card key={sc.title} padding="md" surface="tinted">
                  <div
                    style={{
                      fontFamily: tokens.typography.fontMono,
                      fontSize: 12,
                      fontWeight: 700,
                      color: tokens.colors.accent,
                      marginBottom: 4,
                    }}
                  >
                    {sc.title}
                  </div>
                  <div
                    style={{
                      fontFamily: tokens.typography.caption.family,
                      fontSize: tokens.typography.caption.size,
                      lineHeight: tokens.typography.caption.line,
                      color: tokens.colors.textSecondary,
                    }}
                  >
                    {sc.description}
                  </div>
                </Card>
              ))}
            </div>

            <Link
              href={cta.href}
              style={{
                fontFamily: tokens.typography.fontSans,
                fontSize: 15,
                fontWeight: 600,
                color: tokens.colors.accent,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {cta.label} →
            </Link>
          </div>

          {/* Visual column */}
          <div style={{ order: visualLeft ? 1 : 2 }}>{visual}</div>
        </div>

        <style>{`
          @media (max-width: 900px) {
            .feature-block-grid {
              grid-template-columns: 1fr !important;
              gap: 32px !important;
            }
            .feature-block-grid > div {
              order: unset !important;
            }
          }
        `}</style>
      </Container>
    </Section>
  );
}
