import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import { FAQ, type FAQItem } from '../ui/FAQ';

const ITEMS: FAQItem[] = [
  {
    q: 'How is this different from using AG-UI directly?',
    a: 'AG-UI is a protocol rather than a complete Angular UI layer. Threadplane is the production surface built on the runtimes that speak it — the chat, threads, interrupts, and generative UI your Angular app actually ships.',
  },
  {
    q: 'Which adapter should I use — @threadplane/langgraph or @threadplane/ag-ui?',
    a: 'If your backend is LangGraph Platform, use @threadplane/langgraph. If your backend speaks the AG-UI protocol (CrewAI, Mastra, Microsoft Agent Framework, AG2, Pydantic AI, or AWS Strands), use @threadplane/ag-ui. Both expose the same provideAgent/injectAgent API — see /docs/choosing-an-adapter for a side-by-side comparison.',
  },
  {
    q: 'Is the Pilot-to-Prod program required?',
    a: 'No. Every package is MIT-licensed and complete on its own. Pilot-to-Prod is for teams who want hands-on delivery, not a software paywall.',
  },
  {
    q: 'What does it cost?',
    a: 'Every package is free under MIT. Production Assurance and Pilot-to-Prod are scoped support and delivery engagements — see the pricing page.',
  },
  {
    q: 'Is this production-ready today?',
    a: 'It runs the full stack in the live workspace built into our docs, and breaking changes are called out in release notes. We support Angular’s current and previous LTS versions.',
  },
  {
    q: 'Where do I report issues?',
    a: 'GitHub Issues. Pilot customers also get a private channel.',
  },
  {
    q: 'Does it work with Angular Universal / SSR?',
    a: 'Streaming is client-side by design — agents are stateful and signal-based. If your shell is SSR’d, the agent-talking parts stay client-only; render fallbacks during hydration via standard Angular SSR patterns.',
  },
];

export function HomeFAQ() {
  return (
    <Section surface="white" ariaLabelledBy="faq-heading">
      <Container>
        <div className="home-faq-intro">
          <div className="home-faq-rail">
            <Eyebrow tone="accent" className="home-faq-eyebrow">
              Questions
            </Eyebrow>
            <span className="home-faq-rail-line" aria-hidden="true" />
          </div>
          <h2 id="faq-heading" className="home-faq-heading">
            Frequently asked questions.
          </h2>
        </div>
        <div className="home-faq-body">
          <FAQ items={ITEMS} />
        </div>
      </Container>
    </Section>
  );
}
