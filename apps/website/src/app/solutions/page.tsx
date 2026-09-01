import Link from 'next/link';
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
          <div className="sol-index-hero-inner">
            <Eyebrow tone="accent" className="sol-index-eyebrow-spaced">Solutions</Eyebrow>
            <h1 id="solutions-hero-heading" className="sol-index-h1">
              AI agents for how enterprises actually work.
            </h1>
            <p className="sol-index-hero-body">
              Streaming, generative UI, and human-in-the-loop patterns that enterprise use cases demand — wired into Angular from day one.
            </p>
          </div>
        </Container>
      </Section>

      {/* Solutions grid */}
      <Section surface="canvas" ariaLabelledBy="solutions-grid-heading">
        <Container>
          <div className="sol-index-grid-header">
            <div className="sol-index-rail">
              <Eyebrow className="sol-index-eyebrow-tight">By use case</Eyebrow>
              <span className="sol-index-rail-line" aria-hidden="true" />
            </div>
            <h2 id="solutions-grid-heading" className="sol-index-h2">
              Where agents earn their keep.
            </h2>
          </div>
          <div className="sol-index-grid">
            {SOLUTIONS.map((s) => (
              <Link key={s.slug} href={`/solutions/${s.slug}`} className="sol-index-card-link">
                <Card padding="lg" hoverable className="sol-index-card">
                  <Eyebrow tone="accent" className="sol-index-eyebrow-tight">{s.eyebrow}</Eyebrow>
                  <h3 className="sol-index-card-title">
                    {s.title.replace('\n', ' ')}
                  </h3>
                  <p className="sol-index-card-subtitle">
                    {s.subtitle}
                  </p>
                  <div className="sol-index-pills-row">
                    {s.proofPoints.slice(0, 2).map((p) => (
                      <Pill key={p.label} variant="neutral">
                        {p.metric} {p.label}
                      </Pill>
                    ))}
                  </div>
                  <span className="sol-index-cta">
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
