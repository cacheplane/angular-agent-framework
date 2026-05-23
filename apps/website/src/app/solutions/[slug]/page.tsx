import { notFound } from 'next/navigation';
import Link from 'next/link';
import { tokens } from '@ngaf/design-tokens';
import {
  getSolutionBySlug,
  getAllSolutionSlugs,
  type ArchitectureLayer,
  type SolutionPainPoint,
  type ProofPoint,
} from '../../../lib/solutions-data';
import { Container } from '../../../components/ui/Container';
import { Section } from '../../../components/ui/Section';
import { Eyebrow } from '../../../components/ui/Eyebrow';
import { Button } from '../../../components/ui/Button';
import { Pill } from '../../../components/ui/Pill';
import { Card } from '../../../components/ui/Card';
import { WhitePaperBlock } from '../../../components/landing/WhitePaperBlock';
import { FinalCTA } from '../../../components/landing/FinalCTA';

interface PageProps {
  params: Promise<{ slug: string }>;
}

const LIBRARY_HREF: Record<string, string> = {
  Agent: '/langgraph',
  Render: '/render',
  Chat: '/chat',
};

export function generateStaticParams() {
  return getAllSolutionSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const solution = getSolutionBySlug(slug);
  if (!solution) return {};
  return {
    title: solution.metaTitle,
    description: solution.metaDescription,
  };
}

function PainPoints({ items, accent }: { items: SolutionPainPoint[]; accent: string }) {
  return (
    <Section surface="canvas" ariaLabelledBy="problem-heading">
      <Container>
        <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto 48px' }}>
          <Eyebrow style={{ color: accent, marginBottom: 12 }}>The problem</Eyebrow>
          <h2
            id="problem-heading"
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
            Why this is hard today.
          </h2>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 16,
            maxWidth: 1100,
            margin: '0 auto',
          }}
        >
          {items.map((p) => (
            <Card key={p.title} padding="lg">
              <h3
                style={{
                  fontFamily: tokens.typography.h3.family,
                  fontSize: 18,
                  lineHeight: 1.3,
                  fontWeight: 600,
                  color: tokens.colors.textPrimary,
                  margin: 0,
                  marginBottom: 10,
                }}
              >
                {p.title}
              </h3>
              <p
                style={{
                  fontFamily: tokens.typography.body.family,
                  fontSize: tokens.typography.body.size,
                  lineHeight: tokens.typography.body.line,
                  color: tokens.colors.textSecondary,
                  margin: 0,
                }}
              >
                {p.description}
              </p>
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  );
}

function Architecture({
  intro,
  layers,
  accent,
}: {
  intro: string;
  layers: ArchitectureLayer[];
  accent: string;
}) {
  return (
    <Section surface="tinted" ariaLabelledBy="arch-heading">
      <Container>
        <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto 48px' }}>
          <Eyebrow style={{ color: accent, marginBottom: 12 }}>Architecture</Eyebrow>
          <h2
            id="arch-heading"
            style={{
              fontFamily: tokens.typography.h2.family,
              fontSize: tokens.typography.h2.size,
              lineHeight: tokens.typography.h2.line,
              fontWeight: 700,
              color: tokens.colors.textPrimary,
              margin: 0,
              marginBottom: 16,
              letterSpacing: '-0.015em',
            }}
          >
            How the three libraries compose.
          </h2>
          <p
            style={{
              fontFamily: tokens.typography.bodyLg.family,
              fontSize: tokens.typography.bodyLg.size,
              lineHeight: tokens.typography.bodyLg.line,
              color: tokens.colors.textSecondary,
              margin: 0,
            }}
          >
            {intro}
          </p>
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
          {layers.map((l) => {
            const href = LIBRARY_HREF[l.library];
            const cardInner = (
              <Card padding="lg" hoverable={!!href} style={{ height: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
                  <h3
                    style={{
                      fontFamily: tokens.typography.fontSerif,
                      fontSize: 22,
                      fontWeight: 700,
                      color: tokens.colors.textPrimary,
                      margin: 0,
                    }}
                  >
                    {l.library}
                  </h3>
                  <Pill variant="accent">{l.pkg}</Pill>
                </div>
                <p
                  style={{
                    fontFamily: tokens.typography.body.family,
                    fontSize: tokens.typography.body.size,
                    lineHeight: tokens.typography.body.line,
                    color: tokens.colors.textSecondary,
                    margin: 0,
                    marginBottom: href ? 16 : 0,
                  }}
                >
                  {l.role}
                </p>
                {href ? (
                  <span
                    style={{
                      fontFamily: tokens.typography.fontSans,
                      fontSize: 14,
                      fontWeight: 600,
                      color: tokens.colors.accent,
                    }}
                  >
                    See {l.library} docs →
                  </span>
                ) : null}
              </Card>
            );
            return href ? (
              <Link key={l.library} href={href} style={{ textDecoration: 'none' }}>
                {cardInner}
              </Link>
            ) : (
              <div key={l.library}>{cardInner}</div>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}

function Capabilities({ items, accent }: { items: ProofPoint[]; accent: string }) {
  return (
    <Section surface="canvas" ariaLabelledBy="capabilities-heading">
      <Container>
        <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto 48px' }}>
          <Eyebrow style={{ color: accent, marginBottom: 12 }}>What you ship</Eyebrow>
          <h2
            id="capabilities-heading"
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
            Capabilities the framework delivers.
          </h2>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 16,
            maxWidth: 1100,
            margin: '0 auto',
          }}
        >
          {items.map((p) => (
            <Card key={p.metric + p.label} padding="lg">
              <div
                style={{
                  fontFamily: tokens.typography.fontSerif,
                  fontStyle: 'italic',
                  fontSize: 32,
                  fontWeight: 700,
                  color: accent,
                  lineHeight: 1.1,
                  margin: 0,
                  marginBottom: 12,
                }}
              >
                {p.metric}
              </div>
              <p
                style={{
                  fontFamily: tokens.typography.body.family,
                  fontSize: tokens.typography.body.size,
                  lineHeight: tokens.typography.body.line,
                  color: tokens.colors.textSecondary,
                  margin: 0,
                }}
              >
                {p.label}
              </p>
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  );
}

export default async function SolutionPage({ params }: PageProps) {
  const { slug } = await params;
  const solution = getSolutionBySlug(slug);
  if (!solution) notFound();

  return (
    <>
      {/* Hero — solution-tinted accent */}
      <Section surface="canvas" ariaLabelledBy="solution-hero-heading">
        <Container>
          <div style={{ maxWidth: 820, margin: '0 auto', textAlign: 'center' }}>
            <Eyebrow style={{ color: solution.color, marginBottom: 16 }}>{solution.eyebrow}</Eyebrow>
            <h1
              id="solution-hero-heading"
              style={{
                fontFamily: tokens.typography.h1.family,
                fontSize: tokens.typography.h1.size,
                lineHeight: tokens.typography.h1.line,
                fontWeight: 700,
                color: tokens.colors.textPrimary,
                margin: 0,
                marginBottom: 24,
                letterSpacing: '-0.02em',
                whiteSpace: 'pre-line',
              }}
            >
              {solution.title}
            </h1>
            <p
              style={{
                fontFamily: tokens.typography.bodyLg.family,
                fontSize: tokens.typography.bodyLg.size,
                lineHeight: tokens.typography.bodyLg.line,
                color: tokens.colors.textSecondary,
                margin: '0 auto 32px',
                maxWidth: 640,
              }}
            >
              {solution.subtitle}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
              <Button variant="primary" size="lg" href="#whitepaper-block">
                Read the field report
              </Button>
              <Button variant="secondary" size="lg" href="/pilot-to-prod">
                See the program
              </Button>
            </div>
          </div>
        </Container>
      </Section>

      <PainPoints items={solution.painPoints} accent={solution.color} />
      <Architecture intro={solution.architectureIntro} layers={solution.architectureLayers} accent={solution.color} />
      <Capabilities items={solution.proofPoints} accent={solution.color} />
      <WhitePaperBlock />
      <FinalCTA
        headline={solution.ctaHeadline}
        subtext={solution.ctaSubtext}
        primary={{ label: 'Talk to us', href: '/pricing#lead-form' }}
        secondary={{ label: 'Read the docs →', href: '/docs' }}
        caption={null}
      />
    </>
  );
}
