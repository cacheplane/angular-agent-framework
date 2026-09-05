import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import { FAQ, type FAQItem } from '../ui/FAQ';

// Four questions the page above does not answer (live-stage spec §3). Copy here is scanned by
// lib/public-copy-contract.ts; absolute claims and retired routes are barred.
const ITEMS: FAQItem[] = [
  {
    q: 'Is Threadplane a backend agent framework?',
    a: (
      <>
        No. Threadplane is the Angular UI layer. Your agent runs in LangGraph, in an
        AG-UI-compatible runtime, or in your own service.{' '}
        <a href="/docs/choosing-an-adapter">Choosing an adapter</a>
      </>
    ),
  },
  {
    q: 'Can I use my existing Angular component library and design system?',
    a: (
      <>
        Yes. The chat compositions are stylable, the primitives are headless, and generated UI
        renders components you register. <a href="/render">Generated UI</a>
      </>
    ),
  },
  {
    q: 'Does generated UI execute arbitrary code?',
    a: (
      <>
        No. The agent emits constrained structured output that is validated against a schema, and
        Angular renders registered components with a per-component fallback.{' '}
        <a href="/docs/render/concepts/json-render-vs-a2ui">json-render and A2UI</a>
      </>
    ),
  },
  {
    q: 'Does Threadplane require a hosted service or an account?',
    a: (
      <>
        No. Every package is MIT and runs inside your Angular application against a backend you
        host. <a href="/pricing">Pricing</a>
      </>
    ),
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
