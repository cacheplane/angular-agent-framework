import { Container } from '../../components/ui/Container';
import { Section } from '../../components/ui/Section';
import { Eyebrow } from '../../components/ui/Eyebrow';
import { CompareTable } from '../../components/pricing/CompareTable';
import { ArchitectureBoundary, PricingComparison } from '../../components/pricing/PricingDetails';
import { CompatibilityMatrix } from '../../components/pricing/CompatibilityMatrix';
import { PricingFAQ } from '../../components/pricing/PricingFAQ';
import { LeadForm } from '../../components/pricing/LeadForm';
import { FinalCTA } from '../../components/landing/FinalCTA';
import { createPageMetadata } from '../../lib/site-metadata';

export const metadata = createPageMetadata({
  title: 'Pricing — Threadplane',
  description:
    'Most Threadplane packages are MIT-licensed. @threadplane/chat is free for permitted noncommercial use and evaluation; commercial production plans start at $29 per developer per month. Threadplane runs in your own stack.',
  pathname: '/pricing',
  type: 'website',
});

export default function PricingPage() {
  return (
    <>
      <Section surface="canvas" ariaLabelledBy="pricing-heading">
        <Container>
          <div className="pricing-page-hero-inner">
            <Eyebrow tone="accent" className="pricing-page-eyebrow-spaced">Pricing</Eyebrow>
            <h1 id="pricing-heading" className="pricing-page-h1">
              From prototype to production.
            </h1>
            <p className="pricing-page-subtitle">
              Start free, then purchase a commercial license when you ship{' '}
              <code>@threadplane/chat</code> in a for-profit context. Threadplane runs inside your
              Angular application and connects to the agent infrastructure you already operate.
            </p>
            <p className="pricing-page-license-line">
              <span>Most packages are MIT</span>
              <span aria-hidden="true">·</span>
              <span>@threadplane/chat requires a license for commercial production</span>
              <span aria-hidden="true">·</span>
              <strong>No Threadplane cloud</strong>
            </p>
          </div>
        </Container>
      </Section>

      <CompareTable />

      <Section surface="tinted" ariaLabelledBy="pricing-value-heading">
        <Container>
          <ArchitectureBoundary />
        </Container>
      </Section>

      <Section surface="canvas" ariaLabelledBy="pricing-comparison-heading">
        <Container size="wide">
          <PricingComparison />
        </Container>
      </Section>

      <Section surface="canvas">
        <Container>
          <Eyebrow className="pricing-page-eyebrow-tight">Compatibility</Eyebrow>
          <h2 className="pricing-page-h2">
            Angular version support
          </h2>
          <p className="pricing-page-compat-body">
            We ship against the versions our CI tests. Other versions may work but aren&apos;t guaranteed.
          </p>
          <CompatibilityMatrix />
        </Container>
      </Section>

      <PricingFAQ />

      <LeadForm />
      <FinalCTA />
    </>
  );
}
