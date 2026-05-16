import { tokens } from '@ngaf/design-tokens';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import { Button } from '../ui/Button';
import { BrowserFrame } from '../ui/BrowserFrame';
import { Pill } from '../ui/Pill';

export function Hero() {
  return (
    <Section surface="canvas" ariaLabelledBy="hero-heading">
      <Container>
        <div
          className="hero-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: 64,
            alignItems: 'center',
          }}
        >
          {/* Left column */}
          <div>
            <Eyebrow tone="accent" style={{ marginBottom: 16 }}>
              Angular Agent Framework · MIT
            </Eyebrow>
            <h1
              id="hero-heading"
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
              Build fullstack agentic Angular apps.
            </h1>
            <p
              style={{
                fontFamily: tokens.typography.bodyLg.family,
                fontSize: tokens.typography.bodyLg.size,
                lineHeight: tokens.typography.bodyLg.line,
                color: tokens.colors.textSecondary,
                margin: 0,
                marginBottom: 32,
                maxWidth: '52ch',
              }}
            >
              Build fullstack agentic Angular apps with signal-native streaming, runtime adapters, generative UI, and production-ready primitives.
            </p>
            <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
              <Button variant="primary" size="lg" href="/docs">
                Get started
              </Button>
              <Button
                variant="ghost"
                size="lg"
                href="https://demo.cacheplane.ai"
                target="_blank"
                rel="noopener noreferrer"
              >
                Try the demo →
              </Button>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Pill variant="accent">MIT licensed</Pill>
              <Pill variant="neutral">Works with LangGraph + AG-UI</Pill>
              <Pill variant="angular">Angular 20+</Pill>
            </div>
          </div>

          {/* Right column — layered collage */}
          <div style={{ position: 'relative', minHeight: 420 }} aria-hidden="true">
            <BrowserFrame
              url="demo.cacheplane.ai"
              rotate={-3}
              elevation="lg"
              style={{ position: 'absolute', top: 0, left: 0, width: '92%' }}
            >
              <img
                src="/screenshots/canonical-demo-conversation.webp"
                alt="Canonical demo — streaming chat rendering a markdown response with code block and table"
                style={{ display: 'block', width: '100%', height: 'auto' }}
                loading="lazy"
                decoding="async"
              />
            </BrowserFrame>
            <BrowserFrame
              url="agent.signal()"
              rotate={4}
              elevation="md"
              style={{
                position: 'absolute',
                top: 160,
                right: 0,
                width: '70%',
                maxWidth: 320,
              }}
            >
              <pre
                style={{
                  margin: 0,
                  padding: '16px 18px',
                  background: '#1a1b26',
                  color: '#a9b1d6',
                  fontFamily: tokens.typography.fontMono,
                  fontSize: 12,
                  lineHeight: 1.6,
                  overflow: 'hidden',
                }}
              >
{`provideAgent({
  apiUrl: '/agent',
});

const a = agent();
a.messages();
a.status();`}
              </pre>
            </BrowserFrame>
          </div>
        </div>

        <style>{`
          @keyframes blink { to { visibility: hidden; } }
          @media (max-width: 900px) {
            .hero-grid {
              grid-template-columns: 1fr !important;
              gap: 40px !important;
            }
          }
        `}</style>
      </Container>
    </Section>
  );
}
