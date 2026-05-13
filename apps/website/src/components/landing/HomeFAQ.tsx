import { tokens } from '@ngaf/design-tokens';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import { FAQ, type FAQItem } from '../ui/FAQ';

const ITEMS: FAQItem[] = [
  {
    q: 'How is this different from CopilotKit or AG-UI directly?',
    a: 'CopilotKit has an Angular SDK; ours is built around signals and DI as the substrate, not a port. AG-UI is a protocol, not a UI library — you still build the Angular side. Angular Agent Framework gives you signal-native primitives plus adapters that hide the protocol, so you can swap LangGraph for AG-UI without rewriting your UI.',
  },
  {
    q: 'Does it work with my existing Angular app?',
    a: 'Yes. Drop provideAgent (or provideAgUiAgent) into your app.config.ts. The headless primitives don’t impose any UI; the chat compositions are opt-in.',
  },
  {
    q: 'Can I use this without LangGraph?',
    a: 'Yes. Use the @ngaf/ag-ui adapter for any AG-UI compliant backend, or implement the agent contract yourself. The Angular side doesn’t know which runtime is behind it.',
  },
  {
    q: 'Is the Pilot-to-Prod program required?',
    a: 'No. The libraries are MIT-licensed and complete on their own. Pilot-to-Prod is for teams who want concierge delivery, not a paywall.',
  },
  {
    q: 'What does it cost?',
    a: 'Libraries: free, MIT. Pilot-to-Prod: scoped per engagement — see the pricing page.',
  },
  {
    q: 'Is this production-ready today?',
    a: 'It runs the full stack in our reference deployment (cockpit.cacheplane.ai), and breaking changes are called out in release notes. We support Angular’s current and previous LTS versions.',
  },
  {
    q: 'Where do I report issues?',
    a: 'GitHub Issues. Pilot customers also get a private channel.',
  },
  {
    q: 'I’m using CopilotKit today — how hard is the migration?',
    a: 'Component-by-component. CopilotKit’s chat hooks have rough equivalents in our agent() signal API, and CopilotKit actions map to LangGraph/AG-UI tool calls. Thread state lives in a service (not the component tree), so plan a session to port that. There isn’t a one-shot codemod.',
  },
  {
    q: 'Does it work with Angular Universal / SSR?',
    a: 'Streaming is client-side by design — agents are stateful and signal-based. If your shell is SSR’d, the agent-talking parts stay client-only; render fallbacks during hydration via standard Angular SSR patterns.',
  },
  {
    q: 'How do I test agent-driven components?',
    a: 'The agent is provided through Angular DI, so test doubles work the way you’re used to — supply a stub agent in your test module, drive it with signals, assert on the rendered output. See /docs/agent/guides/testing.',
  },
];

export function HomeFAQ() {
  return (
    <Section surface="white" ariaLabelledBy="faq-heading">
      <Container>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <Eyebrow tone="accent" style={{ marginBottom: 16 }}>
            Questions
          </Eyebrow>
          <h2
            id="faq-heading"
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
            Frequently asked questions.
          </h2>
        </div>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <FAQ items={ITEMS} />
        </div>
      </Container>
    </Section>
  );
}
