import { tokens } from '@threadplane/design-tokens';
import { Container } from '../../components/ui/Container';
import { Section } from '../../components/ui/Section';
import { Eyebrow } from '../../components/ui/Eyebrow';
import { Button } from '../../components/ui/Button';
import { Pill } from '../../components/ui/Pill';
import { BrowserFrame } from '../../components/ui/BrowserFrame';
import { FeatureBlock } from '../../components/landing/FeatureBlock';
import { WhitePaperBlock } from '../../components/landing/WhitePaperBlock';
import { FinalCTA } from '../../components/landing/FinalCTA';
import { RenderCodeShowcase } from '../../components/landing/render/RenderCodeShowcase';
import { createPageMetadata } from '../../lib/site-metadata';

export const metadata = createPageMetadata({
  title: '@threadplane/render — Generative UI for Angular',
  description: 'Agents that render UI without coupling to your frontend. Built on Vercel json-render spec.',
  pathname: '/render',
  type: 'website',
});

export default async function RenderPage() {
  return (
    <>
      {/* Hero */}
      <Section surface="canvas" ariaLabelledBy="render-hero-heading">
        <Container>
          <div style={{ maxWidth: 820, margin: '0 auto', textAlign: 'center' }}>
            <Eyebrow tone="accent" style={{ marginBottom: 16 }}>@threadplane/render</Eyebrow>
            <h1
              id="render-hero-heading"
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
              Generative UI without a second framework.
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
              Server-emitted JSON specs render into Angular components you already own. Vercel json-render and Google A2UI both supported. Per-component fallback, readiness gate, no surprises.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
              <Button variant="primary" size="lg" href="/docs/render/getting-started/introduction">Get started</Button>
              <Button variant="secondary" size="lg" href="https://github.com/cacheplane/angular-agent-framework" target="_blank" rel="noopener noreferrer">View source</Button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Pill variant="accent">MIT</Pill>
              <Pill variant="neutral">Vercel json-render</Pill>
              <Pill variant="neutral">Google A2UI</Pill>
            </div>
          </div>
        </Container>
      </Section>

      <FeatureBlock
        id="schemas"
        eyebrow="Schemas"
        headline="One spec. Your components."
        body="The agent emits structured UI as JSON. @threadplane/render maps each spec node to one of your Angular components — so the design system stays yours, and the agent gets to assemble it."
        bullets={[
          'Vercel json-render adapter',
          'Google A2UI protocol',
          'Component registry — declare once, use everywhere',
          'Server schema, client validation',
        ]}
        supportingCards={[
          { title: 'json-render', description: 'Vercel adapter.' },
          { title: 'A2UI v1', description: 'Google A2UI protocol.' },
          { title: 'registry', description: 'Spec → component.' },
        ]}
        cta={{ label: 'See @threadplane/render docs', href: '/docs/render/getting-started/introduction' }}
        visual={
          <BrowserFrame url="render · spec → component" elevation="md">
            <div style={{ padding: 24, minHeight: 320, background: tokens.surfaces.surface }}>
              <div style={{
                background: tokens.surfaces.surfaceTinted,
                border: `1px solid ${tokens.surfaces.border}`,
                borderRadius: tokens.radius.md,
                padding: 12,
                marginBottom: 12,
                fontFamily: tokens.typography.fontMono,
                fontSize: 11,
                color: tokens.colors.textSecondary,
                whiteSpace: 'pre',
              }}>
{`{
  "type": "card",
  "props": {
    "title": "Q3 revenue",
    "value": "$4.2M",
    "delta": "+18%"
  }
}`}
              </div>
              <div style={{
                background: tokens.surfaces.surface,
                border: `1px solid ${tokens.surfaces.border}`,
                borderRadius: tokens.radius.md,
                padding: 16,
              }}>
                <div style={{ fontFamily: tokens.typography.fontMono, fontSize: 11, color: tokens.colors.accent, marginBottom: 8 }}>
                  AI-rendered · YourCardComponent
                </div>
                <div style={{ fontFamily: tokens.typography.fontSerif, fontSize: 18, fontWeight: 700, color: tokens.colors.textPrimary, marginBottom: 4 }}>
                  Q3 revenue: $4.2M
                </div>
                <div style={{ fontSize: 13, color: tokens.colors.textSecondary }}>+18% vs Q2</div>
              </div>
            </div>
          </BrowserFrame>
        }
      />

      <FeatureBlock
        id="fallbacks"
        eyebrow="Fallbacks"
        headline="Readiness gate + per-component fallback."
        body="When the agent emits a spec your registry doesn't know how to render, @threadplane/render falls back gracefully — and surfaces it to your observability layer. No mystery white screens."
        bullets={[
          'Per-component fallback API',
          'Readiness gate holds renders until safe',
          'Telemetry hook for render events',
          'Streaming partial renders supported',
        ]}
        supportingCards={[
          { title: 'fallback views', description: 'Per-component recovery.' },
          { title: 'readiness gate', description: 'Hold until safe.' },
          { title: 'render events', description: 'Telemetry surface.' },
        ]}
        cta={{ label: 'Fallback patterns', href: '/docs/render/guides/registry' }}
        visualLeft
        visual={<RenderCodeShowcase />}
      />

      <WhitePaperBlock paper="render" />
      <FinalCTA />
    </>
  );
}
