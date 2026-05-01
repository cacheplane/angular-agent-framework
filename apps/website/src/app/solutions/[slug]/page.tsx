import { notFound } from 'next/navigation';
import { tokens } from '@ngaf/design-tokens';
import { getSolutionBySlug, getAllSolutionSlugs } from '../../../lib/solutions-data';
import { SolutionHero } from '../../../components/landing/solutions/SolutionHero';
import { SolutionProblem } from '../../../components/landing/solutions/SolutionProblem';
import { SolutionArchitecture } from '../../../components/landing/solutions/SolutionArchitecture';
import { SolutionProofPoints } from '../../../components/landing/solutions/SolutionProofPoints';
import { SolutionFooterCTA } from '../../../components/landing/solutions/SolutionFooterCTA';
import { WhitePaperSection } from '../../../components/landing/WhitePaperSection';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getAllSolutionSlugs().map(slug => ({ slug }));
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

export default async function SolutionPage({ params }: PageProps) {
  const { slug } = await params;
  const solution = getSolutionBySlug(slug);
  if (!solution) notFound();

  return (
    <div style={{ background: tokens.gradient.bgFlow, position: 'relative', overflow: 'hidden' }}>
      {/* Ambient gradient blobs */}
      <div
        style={{
          position: 'absolute',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(${solution.rgb}, 0.12) 0%, transparent 70%)`,
          top: -200,
          left: -150,
          filter: 'blur(80px)',
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      />
      <div
        style={{
          position: 'absolute',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: tokens.gradient.cool,
          top: 800,
          right: -100,
          filter: 'blur(80px)',
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      />
      <div
        style={{
          position: 'absolute',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(${solution.rgb}, 0.08) 0%, transparent 70%)`,
          top: 2200,
          left: -100,
          filter: 'blur(80px)',
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      />

      <SolutionHero solution={solution} />
      <SolutionProblem
        color={solution.color}
        painPoints={solution.painPoints}
      />
      <SolutionArchitecture
        color={solution.color}
        intro={solution.architectureIntro}
        layers={solution.architectureLayers}
      />
      <SolutionProofPoints
        color={solution.color}
        proofPoints={solution.proofPoints}
      />
      <WhitePaperSection />
      <SolutionFooterCTA
        color={solution.color}
        headline={solution.ctaHeadline}
        subtext={solution.ctaSubtext}
      />
    </div>
  );
}
