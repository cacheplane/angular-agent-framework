import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import { FAQ, type FAQItem } from '../ui/FAQ';

const ITEMS: FAQItem[] = [
  {
    q: 'Is Threadplane free?',
    a: 'Most Threadplane packages are MIT-licensed and free for commercial or noncommercial use. @threadplane/chat is free for uses permitted by PolyForm Noncommercial 1.0.0 and for a 30-calendar-day commercial evaluation. Commercial production use of @threadplane/chat requires a Threadplane Commercial license.',
  },
  {
    q: 'Is @threadplane/chat open source?',
    a: 'Most Threadplane packages are MIT open source. @threadplane/chat is source-available under the PolyForm Noncommercial License 1.0.0 and is not OSI open source.',
  },
  {
    q: 'What counts as commercial use?',
    a: 'Commercial use means using @threadplane/chat in an application, product, service, internal tool, client deliverable, hosted experience, or workflow that is operated by or for a for-profit entity, generates revenue, supports paid services, supports business operations, or is delivered to a paying client.',
  },
  {
    q: 'Does Threadplane have a cloud service?',
    a: 'No. Threadplane runs inside your Angular application. You operate your application, agent runtime, data stores, hosting, and model-provider accounts.',
  },
  {
    q: 'Does Threadplane store my conversations or agent data?',
    a: 'No hosted Threadplane persistence service is included. Threadplane provides Angular UI packages and adapter contracts for thread state, history, branching, reload, and interrupts. The connected runtime and persistence layer determine storage, checkpointing, retention, authorization, and cross-device behavior.',
  },
  {
    q: 'Are model or hosting costs included?',
    a: 'No. Model inference, agent runtime, database, observability, hosting, and other infrastructure charges remain with the providers you select.',
  },
  {
    q: 'What am I paying for?',
    a: 'Paid plans provide commercial production rights for @threadplane/chat, developer-seat or organization scope, support, and contract or procurement services. They do not provide hosted usage, bundled infrastructure, or a different package build.',
  },
  {
    q: 'Do my end users need licenses?',
    a: 'No. End users of a licensed application do not need seats. Commercial coverage applies to the developers, organization, or application scope defined by the plan or contract.',
  },
  {
    q: 'What is a developer seat?',
    a: 'A developer seat covers one developer working on or maintaining the licensed application. Contact sales for contractor, subsidiary, or other organizational edge cases not addressed by the standard commercial summary.',
  },
  {
    q: 'Does a paid plan unlock different software?',
    a: 'No. Paid plans use the same source and package build. The plan changes permitted use, developer coverage, support, and contractual scope—not core product capabilities.',
  },
  {
    q: 'How does the license token work?',
    a: 'The package verifies the signed token locally with Ed25519. Verification does not call a Threadplane licensing API at runtime. A missing, expired, or invalid token produces an advisory console warning and does not block rendering.',
  },
  {
    q: 'Can I modify or redistribute the source?',
    a: 'You may modify @threadplane/chat within your permitted use and embed it in a larger licensed application. You may not redistribute it as a standalone package or as part of a competing component library, SDK, template kit, app builder, or design system.',
  },
  {
    q: 'What happens after cancellation or refund?',
    a: 'After cancellation, the license remains valid through the end of the current paid period. A refund marks the license revoked in Threadplane records and triggers a confirmation email. Runtime token verification remains offline and does not make a revocation lookup.',
  },
];

export function PricingFAQ() {
  return (
    <Section surface="white" ariaLabelledBy="pricing-faq-heading">
      <Container>
        <div id="faq" className="pricing-faq-header">
          <Eyebrow tone="accent" className="pricing-faq-eyebrow">
            Questions
          </Eyebrow>
          <h2 id="pricing-faq-heading" className="pricing-faq-heading">
            Licensing FAQ.
          </h2>
        </div>
        <div className="pricing-faq-items">
          <FAQ items={ITEMS} />
        </div>
      </Container>
    </Section>
  );
}
