import { tokens } from '@ngaf/design-tokens';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import { FAQ, type FAQItem } from '../ui/FAQ';

const ITEMS: FAQItem[] = [
  {
    q: 'How is this different from CopilotKit or AG-UI directly?',
    a: 'CopilotKit ports React patterns to Angular. AG-UI is a protocol — you still build the Angular side. Angular Agent Framework is Angular-native: signals, DI, zoneless support, and adapters that hide the protocol so you can swap LangGraph for AG-UI without rewriting your UI.',
  },
  {
    q: 'Does it work with my existing Angular app?',
    a: 'Yes. Drop provideAgent (or provideAgUiAgent) into your app.config.ts. The headless primitives don’t impose any UI; the chat compositions are opt-in.',
  },
  {
    q: 'Is it zoneless-compatible?',
    a: 'Yes. All signal flows are zoneless-safe. We test against zoneless apps.',
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
    a: 'Yes — the Cockpit reference app runs the full stack. We track Angular’s release cadence and ship against current and one previous major.',
  },
  {
    q: 'Where do I report issues?',
    a: 'GitHub Issues. Pilot customers also get a private channel.',
  },
];

export function HomeFAQ() {
  return (
    <Section surface="white" ariaLabelledBy="faq-heading">
      <Container>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <Eyebrow tone="accent" style={{ marginBottom: 16 }}>Questions</Eyebrow>
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
