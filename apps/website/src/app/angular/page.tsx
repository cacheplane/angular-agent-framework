import { tokens } from '@ngaf/design-tokens';
import { Container } from '../../components/ui/Container';
import { Section } from '../../components/ui/Section';
import { Eyebrow } from '../../components/ui/Eyebrow';
import { Button } from '../../components/ui/Button';
import { Pill } from '../../components/ui/Pill';
import { BrowserFrame } from '../../components/ui/BrowserFrame';
import { FeatureBlock } from '../../components/landing/FeatureBlock';
import { WhitePaperBlock } from '../../components/landing/WhitePaperBlock';
import { FinalCTA } from '../../components/landing/FinalCTA';
import { AngularCodeShowcase } from '../../components/landing/angular/AngularCodeShowcase';
import { createPageMetadata } from '../../lib/site-metadata';

export const metadata = createPageMetadata({
  title: '@ngaf/langgraph — Agent Streaming for Angular',
  description: 'Ship LangGraph agents in Angular. Signal-native streaming, thread persistence, interrupts, and deterministic testing.',
  pathname: '/angular',
  type: 'website',
});

export default async function AngularPage() {
  return (
    <>
      {/* Hero */}
      <Section surface="canvas" ariaLabelledBy="angular-hero-heading">
        <Container>
          <div style={{ maxWidth: 820, margin: '0 auto', textAlign: 'center' }}>
            <Eyebrow tone="angular" style={{ marginBottom: 16 }}>@ngaf/langgraph</Eyebrow>
            <h1
              id="angular-hero-heading"
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
              Signal-native streaming for Angular.
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
              Ship LangGraph agents inside your Angular 20+ app. Thread state, interrupts, branch/history, and tool progress — all surfaced as signals.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
              <Button variant="primary" size="lg" href="/docs/agent/getting-started/introduction">Get started</Button>
              <Button variant="secondary" size="lg" href="https://github.com/cacheplane/angular-agent-framework" target="_blank" rel="noopener noreferrer">View source</Button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Pill variant="accent">MIT</Pill>
              <Pill variant="angular">Angular 20+</Pill>
              <Pill variant="neutral">LangGraph + AG-UI</Pill>
            </div>
          </div>
        </Container>
      </Section>

      <FeatureBlock
        id="providers"
        eyebrow="Providers"
        headline="Drop it into app.config.ts. Done."
        body="provideAgent wires LangGraph (or AG-UI) into Angular's DI container. From any component, agent() returns a signal-based handle for messages, status, errors, and interrupts."
        bullets={[
          'provideAgent + provideAgUiAgent — pick your runtime',
          'agent() returns a typed signal-based handle',
          'OnPush tested',
          'Test transports for deterministic specs',
        ]}
        supportingCards={[
          { title: 'provideAgent', description: 'LangGraph wiring.' },
          { title: 'provideAgUiAgent', description: 'AG-UI wiring.' },
          { title: 'MockAgentTransport', description: 'Deterministic tests.' },
        ]}
        cta={{ label: 'API reference', href: '/docs/agent/api/agent' }}
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
{`import { provideAgent } from '@ngaf/langgraph';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAgent({
      apiUrl: '/agent',
      assistantId: 'my-agent',
    }),
  ],
};

// any component
export class ChatComponent {
  agent = agent();
  messages = this.agent.messages;
  status = this.agent.status;
}`}
            </pre>
          </BrowserFrame>
        }
      />

      <FeatureBlock
        id="signals"
        eyebrow="Signals"
        headline="Reactive without RxJS gymnastics."
        body="Every agent surface is exposed as a signal — message stream, tool progress, interrupts, errors, status. Compose with the rest of your Angular reactivity story. No subscriptions to leak."
        bullets={[
          'messages() / status() / error() / reload()',
          'interrupt() for human-in-the-loop gates',
          'Branch / history / time-travel built in',
          'Computed signals integrate cleanly',
        ]}
        supportingCards={[
          { title: 'messages()', description: 'Streaming message list.' },
          { title: 'interrupt()', description: 'Approval-gate signal.' },
          { title: 'reload()', description: 'Recover from errors.' },
        ]}
        cta={{ label: 'Read the streaming guide', href: '/docs/agent/api/agent' }}
        visualLeft
        visual={<AngularCodeShowcase />}
      />

      <WhitePaperBlock paper="angular" />
      <FinalCTA />
    </>
  );
}
