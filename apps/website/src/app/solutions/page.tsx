import { tokens } from '@cacheplane/design-tokens';
import { SolutionsGrid } from '../../components/landing/solutions/SolutionsGrid';
import { WhitePaperSection } from '../../components/landing/WhitePaperSection';
import { PilotFooterCTA } from '../../components/landing/PilotFooterCTA';

export const metadata = {
  title: 'Solutions — Angular Agent Framework',
  description: 'See how Angular Agent Framework solves enterprise challenges — compliance, analytics, and customer support.',
};

export default function SolutionsIndexPage() {
  return (
    <div style={{ background: tokens.gradient.bgFlow, position: 'relative', overflow: 'hidden' }}>
      {/* Ambient gradient blobs */}
      <div
        style={{
          position: 'absolute',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: tokens.gradient.warm,
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

      {/* Hero */}
      <section style={{ position: 'relative', overflow: 'hidden', padding: '0 2rem' }}>
        <div
          style={{
            maxWidth: '56rem',
            margin: '0 auto',
            textAlign: 'center',
            position: 'relative',
            zIndex: 1,
          }}
          className="py-24 md:py-32"
        >
          <p
            style={{
              fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
              fontSize: 11,
              letterSpacing: '0.08em',
              color: tokens.colors.accent,
              textTransform: 'uppercase',
              marginBottom: '1.5rem',
            }}
          >
            Solutions
          </p>
          <h1
            style={{
              fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
              fontSize: 'clamp(36px, 5vw, 56px)',
              fontWeight: 700,
              lineHeight: 1.1,
              color: tokens.colors.textPrimary,
              marginBottom: '1.25rem',
            }}
          >
            AI agents built for how enterprises actually work
          </h1>
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 18,
              color: tokens.colors.textSecondary,
              maxWidth: '52ch',
              margin: '0 auto',
              lineHeight: 1.6,
            }}
          >
            Angular Agent Framework gives your team the streaming, generative UI, and human-in-the-loop patterns that enterprise use cases demand.
          </p>
        </div>
      </section>

      <SolutionsGrid />
      <WhitePaperSection />
      <PilotFooterCTA />
    </div>
  );
}
