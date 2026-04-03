import { GenerativeUIFrame } from './GenerativeUIFrame';
import { CopyPromptButton } from '../docs/CopyPromptButton';
import { getPromptBySlug } from '../../lib/docs';
import { Badge } from '@/components/ui/badge';

function LangChainBadge() {
  return (
    <Badge variant="default">
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: 3,
          background: 'rgba(127,200,255,0.2)',
          border: '1px solid rgba(127,200,255,0.4)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 7,
          fontWeight: 700,
          color: '#7FC8FF',
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        LC
      </span>
      LangChain
    </Badge>
  );
}

function AngularBadge() {
  return (
    <Badge variant="default">
      <svg width="14" height="14" viewBox="0 0 250 250" aria-hidden={true} style={{ flexShrink: 0 }}>
        <path fill="#DD0031" d="M125 30L31.9 63.2l14.2 123.1L125 230l78.9-43.7 14.2-123.1z" />
        <path fill="#C3002F" d="M125 30v22.2l-61.7 162.4 37.8 15.4z" />
        <path fill="#fff" d="M125 52.1L66.8 182.6h21.7l11.7-29.2h49.4l11.7 29.2H183L125 52.1zm17 83.3h-34l17-40.9z" />
      </svg>
      Angular
    </Badge>
  );
}

export async function HeroTwoCol() {
  const prompt = getPromptBySlug(['getting-started']) ?? '';

  return (
    <section className="hero-two-col" aria-labelledby="hero-heading">
      <style>{`
        .hero-two-col {
          display: flex;
          align-items: center;
          padding: 96px 40px 60px;
          gap: 48px;
          min-height: 100vh;
        }
        .hero-left { flex: 0 0 55%; max-width: 55%; }
        .hero-right { flex: 0 0 45%; max-width: 45%; display: flex; justify-content: center; }
        @media (max-width: 767px) {
          .hero-two-col { flex-direction: column; padding: 80px 24px 40px; }
          .hero-left { flex: none; max-width: 100%; width: 100%; }
          .hero-right { flex: none; max-width: 100%; width: 100%; max-height: 300px; overflow: hidden; }
        }
      `}</style>

      {/* Left column — 55% */}
      <div className="hero-left">
        <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
          <LangChainBadge />
          <AngularBadge />
        </div>

        <h1
          id="hero-heading"
          style={{
            fontFamily: 'var(--font-garamond)',
            fontSize: 'clamp(36px, 4.5vw, 72px)',
            fontWeight: 800,
            lineHeight: 1.05,
            color: '#EEF1FF',
            margin: 0,
            marginBottom: 20,
          }}
        >
          The Enterprise Streaming Resource for LangChain and{' '}
          <span style={{ color: '#DD0031', textShadow: '0 0 30px rgba(221,0,49,0.5)' }}>
            Angular
          </span>
        </h1>

        <p
          style={{
            fontFamily: 'var(--font-garamond)',
            fontStyle: 'italic',
            fontSize: 'clamp(16px, 1.8vw, 20px)',
            color: '#8B96C8',
            maxWidth: '44ch',
            lineHeight: 1.5,
            margin: 0,
            marginBottom: 32,
          }}
        >
          Full parity with React{' '}
          <code
            style={{
              fontStyle: 'normal',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8em',
              background: 'rgba(108,142,255,0.08)',
              color: '#6C8EFF',
              padding: '2px 6px',
              borderRadius: 4,
            }}
          >
            useStream()
          </code>
          {' '}— built natively for Angular 20+.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
          <CopyPromptButton prompt={prompt} variant="hero" />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#4A527A' }}>
            npm install @cacheplane/stream-resource
          </span>
        </div>
      </div>

      {/* Right column — 45% */}
      <div className="hero-right">
        <GenerativeUIFrame />
      </div>
    </section>
  );
}
