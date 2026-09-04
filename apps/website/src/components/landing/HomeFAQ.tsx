import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import { FAQ, type FAQItem } from '../ui/FAQ';
import { formatAngularRange } from '../../lib/positioning';
import { WEBSITE_SUPPORTED_ANGULAR_MAJORS } from '../pricing/angular-support.mjs';

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
    q: 'Does Threadplane require LangGraph?',
    a: (
      <>
        No. <code>@threadplane/ag-ui</code> connects any AG-UI-compatible backend, and{' '}
        <code>@threadplane/langgraph</code> is the direct LangGraph adapter.{' '}
        <a href="/ag-ui">AG-UI on Threadplane</a>
      </>
    ),
  },
  {
    q: 'What is the difference between the LangGraph and AG-UI adapters?',
    a: (
      <>
        Both implement the same <code>Agent</code> contract. LangGraph adds native threads,
        checkpoints, history, and branch mapping; AG-UI maps the protocol&apos;s events and depends
        on what the backend emits. <a href="/docs/choosing-an-adapter">Choosing an adapter</a>
      </>
    ),
  },
  {
    q: 'Where are threads and checkpoints stored?',
    a: (
      <>
        In your backend&apos;s persistence layer. Threadplane exposes thread, history, and resume
        behavior in the UI; durability comes from the runtime you operate.{' '}
        <a href="/docs/langgraph/guides/persistence">Persistence guide</a>
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
    q: 'Can I test the UI without a model or a live backend?',
    a: (
      <>
        Yes. <code>provideFakeAgent()</code> streams canned tokens in-process, and mock transports
        script tool calls and interrupts.{' '}
        <a href="/docs/chat/getting-started/try-without-a-backend">Try it without a backend</a>
      </>
    ),
  },
  {
    q: 'Which Angular versions are supported?',
    a: (
      <>
        Threadplane supports {formatAngularRange(WEBSITE_SUPPORTED_ANGULAR_MAJORS)}. The installation
        guide lists the peer ranges for every package.{' '}
        <a href="/docs/langgraph/getting-started/installation">Installation</a>
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
  {
    // The absolute framing this question used to carry ("installation is
    // inert", linking the retired telemetry docs library) is barred copy —
    // see lib/public-copy-contract.ts. /privacy is the canonical answer.
    q: 'What does Threadplane report about my application?',
    a: (
      <>
        Operational facts about how the product is running — activity, not content. Prompts,
        messages, tool inputs and outputs, application state, and source code are outside what
        that reporting is designed to carry. <a href="/privacy">Privacy policy</a>
      </>
    ),
  },
  {
    q: 'How does Threadplane differ from a raw streaming SDK?',
    a: (
      <>
        A streaming SDK gives you events. Threadplane gives you the Angular state model, chat UX,
        threads, approvals, generated UI, recovery, and tests on top of them.{' '}
        <a href="/chat">Chat</a>
      </>
    ),
  },
  {
    q: 'How does Threadplane compare with other Angular agent UI libraries?',
    a: (
      <>
        Threadplane is the runtime-neutral Angular UI layer: direct LangGraph and AG-UI adapters, a
        fake-agent test path, design-system-owned generated UI, and no hosted layer in the loop. A
        dated, sourced comparison page is planned.{' '}
        <a href="/docs/choosing-an-adapter">Choosing an adapter</a>
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
