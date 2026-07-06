import Link from 'next/link';
import { tokens } from '@threadplane/design-tokens';
import { Container } from '../../components/ui/Container';
import { Section } from '../../components/ui/Section';
import { Eyebrow } from '../../components/ui/Eyebrow';
import { Button } from '../../components/ui/Button';
import { Pill } from '../../components/ui/Pill';
import { BrowserFrame } from '../../components/ui/BrowserFrame';
import { FeatureBlock } from '../../components/landing/FeatureBlock';
import { FinalCTA } from '../../components/landing/FinalCTA';
import { BackendsGrid } from '../../components/landing/ag-ui/BackendsGrid';
import { createPageMetadata, SHORT_POSITIONING_DESCRIPTION } from '../../lib/site-metadata';

export const metadata = createPageMetadata({
  title: '@threadplane/ag-ui — Threadplane',
  description: SHORT_POSITIONING_DESCRIPTION,
  pathname: '/ag-ui',
  type: 'website',
});

export default async function AgUiPage() {
  return (
    <>
      {/* Hero */}
      <Section surface="canvas" ariaLabelledBy="ag-ui-hero-heading">
        <Container>
          <div style={{ maxWidth: 820, margin: '0 auto', textAlign: 'center' }}>
            <Eyebrow tone="accent" style={{ marginBottom: 16 }}>@threadplane/ag-ui</Eyebrow>
            <h1
              id="ag-ui-hero-heading"
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
              One adapter. Eight backends.
            </h1>
            <p
              style={{
                fontFamily: tokens.typography.bodyLg.family,
                fontSize: tokens.typography.bodyLg.size,
                lineHeight: tokens.typography.bodyLg.line,
                color: tokens.colors.textSecondary,
                margin: '0 auto 32px',
                maxWidth: 680,
              }}
            >
              Build an Angular agent UI on any AG-UI-compatible runtime — CrewAI, Mastra, Microsoft Agent Framework, AG2, Pydantic AI, AWS Strands, CopilotKit, or LangGraph fronted by AG-UI. Same Agent contract and chat surface; runtime-specific history and checkpoint behavior stays with the backend.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              <Button variant="primary" size="lg" href="/docs/ag-ui/getting-started/quickstart">Get started</Button>
              <Button variant="secondary" size="lg" href="https://github.com/cacheplane/angular-agent-framework" target="_blank" rel="noopener noreferrer">View source</Button>
            </div>
            <p style={{ fontSize: 13, color: tokens.colors.textMuted, marginBottom: 20 }}>
              Talking to LangGraph Platform directly? See <a href="/docs/choosing-an-adapter" style={{ color: tokens.colors.accent }}>Choosing an adapter</a>.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
              <Pill variant="accent">MIT</Pill>
              <Pill variant="angular">Angular 20+</Pill>
              <Pill variant="neutral">AG-UI protocol</Pill>
            </div>
            <p
              style={{
                fontFamily: tokens.typography.fontSans,
                fontSize: 13,
                color: tokens.colors.textMuted,
                margin: '0 auto',
                maxWidth: 520,
              }}
            >
              Already on LangGraph?{' '}
              <Link
                href="/langgraph"
                style={{ color: tokens.colors.accent, textDecoration: 'none', fontWeight: 600 }}
              >
                See @threadplane/langgraph
              </Link>{' '}
              for native streaming, checkpoints, and the typed LangGraph SDK path.
            </p>
          </div>
        </Container>
      </Section>

      <FeatureBlock
        id="backends"
        eyebrow="Runtime choice"
        headline="Pick a backend. Keep the UI."
        body="The AG-UI protocol decouples your agent runtime from your front-end. @threadplane/ag-ui wraps any AG-UI AbstractAgent into the runtime-neutral Agent contract that @threadplane/chat consumes — so the same Angular components ship against eight different runtimes."
        bullets={[
          'Stream from Python, .NET, or TypeScript backends — same chat primitives',
          'Swap runtimes without rewriting the UI layer',
          'Protocol-first: tool calls, state deltas, citations all standardized',
          'Future runtimes that ship AG-UI work day-one',
        ]}
        supportingCards={[
          { title: 'LangGraph', description: 'Python or TS via AG-UI.' },
          { title: 'Mastra', description: 'TypeScript-native.' },
          { title: 'CrewAI / AG2', description: 'Multi-agent crews.' },
        ]}
        cta={{ label: 'Browse the AG-UI protocol', href: 'https://github.com/ag-ui-protocol/ag-ui' }}
        visual={<BackendsGrid />}
      />

      <FeatureBlock
        id="primitives"
        eyebrow="Same primitives"
        headline="Drop-in for everything @threadplane/chat ships."
        body="provideAgent registers an AG-UI client and exposes the same Agent contract that @threadplane/langgraph provides. Chat rendering, status, tool calls, generative UI, and citations use the same Angular primitives; durable checkpointed threads and history depend on the backend protocol, so use @threadplane/langgraph when you need the native LangGraph thread API."
        bullets={[
          'provideAgent + injectAgent — same names across adapters',
          'Shared Agent contract: messages() / status() / reload()',
          'Same A2UI surface, themes, and citations rendering',
          'MockAgentTransport works the same way for tests',
        ]}
        supportingCards={[
          { title: 'provideAgent', description: 'AG-UI wiring.' },
          { title: 'injectAgent()', description: 'No-args helper.' },
          { title: '@threadplane/chat', description: 'Same components.' },
        ]}
        cta={{ label: 'API reference', href: '/docs/langgraph/api/inject-agent' }}
        visualLeft
        visual={
          <BrowserFrame url="app.config.ts" elevation="md">
            <pre style={{
              margin: 0,
              padding: '20px 22px',
              background: '#1a1b26',
              color: '#a9b1d6',
              fontFamily: tokens.typography.fontMono,
              fontSize: 13,
              lineHeight: 1.6,
              minHeight: 320,
              overflow: 'auto',
            }}>
{`import { provideAgent, injectAgent } from '@threadplane/ag-ui';
import { ChatComponent } from '@threadplane/chat';

// app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideAgent({
      url: 'https://your.agent.endpoint',
    }),
  ],
};

// component
@Component({
  imports: [ChatComponent],
  template: \`<chat [agent]="agent" />\`,
})
export class App {
  protected readonly agent = injectAgent();
}`}
            </pre>
          </BrowserFrame>
        }
      />

      <FinalCTA />
    </>
  );
}
