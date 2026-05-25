import Link from 'next/link';
import { tokens } from '@threadplane/design-tokens';
import { Container } from '../../components/ui/Container';
import { Section } from '../../components/ui/Section';
import { Eyebrow } from '../../components/ui/Eyebrow';
import { Card } from '../../components/ui/Card';
import { Pill } from '../../components/ui/Pill';
import { WhitePaperBlock } from '../../components/landing/WhitePaperBlock';
import { FinalCTA } from '../../components/landing/FinalCTA';
import { SOLUTIONS } from '../../lib/solutions-data';
import { createPageMetadata } from '../../lib/site-metadata';

export const metadata = createPageMetadata({
  title: 'Solutions — Threadplane',
  description: 'See how Threadplane solves enterprise challenges — compliance, analytics, and customer support.',
  pathname: '/solutions',
  type: 'website',
});

export default function SolutionsIndexPage() {
  return (
    <>
      {/* Hero */}
      <Section surface="canvas" ariaLabelledBy="solutions-hero-heading">
        <Container>
          <div style={{ maxWidth: 820, margin: '0 auto', textAlign: 'center' }}>
            <Eyebrow tone="accent" style={{ marginBottom: 16 }}>Solutions</Eyebrow>
            <h1
              id="solutions-hero-heading"
              style={{
                fontFamily: tokens.typography.h1.family,
                fontSize: tokens.typography.h1.size,
                lineHeight: tokens.typography.h1.line,
                fontWeight: 700,
                color: tokens.colors.textPrimary,
                margin: 0,
                marginBottom: 24,
                letterSpacing: '-0.02em',
              }}
            >
              AI agents for how enterprises actually work.
            </h1>
            <p
              style={{
                fontFamily: tokens.typography.bodyLg.family,
                fontSize: tokens.typography.bodyLg.size,
                lineHeight: tokens.typography.bodyLg.line,
                color: tokens.colors.textSecondary,
                margin: '0 auto',
                maxWidth: 640,
              }}
            >
              Streaming, generative UI, and human-in-the-loop patterns that enterprise use cases demand — wired into Angular from day one.
            </p>
          </div>
        </Container>
      </Section>

      {/* Solutions grid */}
      <Section surface="canvas" ariaLabelledBy="solutions-grid-heading">
        <Container>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <Eyebrow style={{ marginBottom: 12 }}>By use case</Eyebrow>
            <h2
              id="solutions-grid-heading"
              style={{
                fontFamily: tokens.typography.h2.family,
                fontSize: tokens.typography.h2.size,
                lineHeight: tokens.typography.h2.line,
                fontWeight: 700,
                color: tokens.colors.textPrimary,
                margin: 0,
                letterSpacing: '-0.015em',
              }}
            >
              Where agents earn their keep.
            </h2>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 16,
              maxWidth: 1100,
              margin: '0 auto',
            }}
          >
            {SOLUTIONS.map((s) => (
              <Link key={s.slug} href={`/solutions/${s.slug}`} style={{ textDecoration: 'none' }}>
                <Card padding="lg" hoverable style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <Eyebrow tone="accent" style={{ marginBottom: 12 }}>{s.eyebrow}</Eyebrow>
                  <h3
                    style={{
                      fontFamily: tokens.typography.h3.family,
                      fontSize: 22,
                      lineHeight: 1.25,
                      fontWeight: 600,
                      color: tokens.colors.textPrimary,
                      margin: 0,
                      marginBottom: 12,
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {s.title.replace('\n', ' ')}
                  </h3>
                  <p
                    style={{
                      fontFamily: tokens.typography.body.family,
                      fontSize: tokens.typography.body.size,
                      lineHeight: tokens.typography.body.line,
                      color: tokens.colors.textSecondary,
                      margin: 0,
                      marginBottom: 16,
                      flex: 1,
                    }}
                  >
                    {s.subtitle}
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                    {s.proofPoints.slice(0, 2).map((p) => (
                      <Pill key={p.label} variant="neutral">
                        {p.metric} {p.label}
                      </Pill>
                    ))}
                  </div>
                  <span
                    style={{
                      fontFamily: tokens.typography.fontSans,
                      fontSize: 14,
                      fontWeight: 600,
                      color: tokens.colors.accent,
                    }}
                  >
                    See the solution →
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        </Container>
      </Section>

      <WhitePaperBlock />
      <FinalCTA />
    </>
  );
}
