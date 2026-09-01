import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  getSolutionBySlug,
  getAllSolutionSlugs,
  type ArchitectureLayer,
  type SolutionPainPoint,
  type ProofPoint,
} from '../../../lib/solutions-data';
import { Container } from '../../../components/ui/Container';
import { Section } from '../../../components/ui/Section';
import { SolutionCodeBlock } from '../../../components/solutions/SolutionCodeBlock';
import { SolutionDemoBlock } from '../../../components/solutions/SolutionDemoBlock';
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

function PainPoints({ items }: { items: SolutionPainPoint[] }) {
  return (
    <Section surface="canvas" ariaLabelledBy="problem-heading">
      <Container>
        <div className="sol-page-section-header">
          <div className="sol-page-rail">
            <Eyebrow tone="accent" className="sol-page-eyebrow-tight">The problem</Eyebrow>
            <span className="sol-page-rail-line" aria-hidden="true" />
          </div>
          <h2 id="problem-heading" className="sol-page-h2">
            Why this is hard today.
          </h2>
        </div>
        <div className="sol-page-grid-260">
          {items.map((p) => (
            <Card key={p.title} padding="lg">
              <h3 className="sol-page-card-h3">
                {p.title}
              </h3>
              <p className="sol-page-card-body">
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
}: {
  intro: string;
  layers: ArchitectureLayer[];
}) {
  return (
    <Section surface="tinted" ariaLabelledBy="arch-heading">
      <Container>
        <div className="sol-page-section-header">
          <div className="sol-page-rail">
            <Eyebrow tone="accent" className="sol-page-eyebrow-tight">Architecture</Eyebrow>
            <span className="sol-page-rail-line" aria-hidden="true" />
          </div>
          <h2 id="arch-heading" className="sol-page-h2 sol-page-h2-spaced">
            How the three libraries compose.
          </h2>
          <p className="sol-page-section-intro">
            {intro}
          </p>
        </div>
        <div className="sol-page-grid-280">
          {layers.map((l) => {
            const href = LIBRARY_HREF[l.library];
            const cardInner = (
              <Card padding="lg" hoverable={!!href} className="sol-page-arch-card">
                <div className="sol-page-arch-card-header">
                  <h3 className="sol-page-arch-title">
                    {l.library}
                  </h3>
                  <Pill variant="accent">{l.pkg}</Pill>
                </div>
                <p className={href ? 'sol-page-role sol-page-role-linked' : 'sol-page-role'}>
                  {l.role}
                </p>
                {href ? (
                  <span className="sol-page-arch-cta">
                    See {l.library} docs →
                  </span>
                ) : null}
              </Card>
            );
            return href ? (
              <Link key={l.library} href={href} className="sol-page-link-plain">
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

function Capabilities({ items }: { items: ProofPoint[] }) {
  return (
    <Section surface="canvas" ariaLabelledBy="capabilities-heading">
      <Container>
        <div className="sol-page-section-header">
          <div className="sol-page-rail">
            <Eyebrow tone="accent" className="sol-page-eyebrow-tight">What you ship</Eyebrow>
            <span className="sol-page-rail-line" aria-hidden="true" />
          </div>
          <h2 id="capabilities-heading" className="sol-page-h2">
            Capabilities the framework delivers.
          </h2>
        </div>
        <div className="sol-page-grid-260">
          {items.map((p) => (
            <Card key={p.metric + p.label} padding="lg">
              <div className="sol-page-metric">
                {p.metric}
              </div>
              <p className="sol-page-card-body">
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
          <div className="sol-page-hero-inner">
            <Eyebrow tone="accent" className="sol-page-eyebrow-spaced">{solution.eyebrow}</Eyebrow>
            <h1 id="solution-hero-heading" className="sol-page-h1">
              {solution.title}
            </h1>
            <p className="sol-page-hero-subtitle">
              {solution.subtitle}
            </p>
            <div className="sol-page-hero-buttons">
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

      <PainPoints items={solution.painPoints} />
      <Architecture intro={solution.architectureIntro} layers={solution.architectureLayers} />
      <Capabilities items={solution.proofPoints} />
      <SolutionCodeBlock code={solution.code} />
      {solution.demo && <SolutionDemoBlock clip={solution.demo} />}
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
