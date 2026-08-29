import { Container } from '../../components/ui/Container';
import { Section } from '../../components/ui/Section';
import { Eyebrow } from '../../components/ui/Eyebrow';
import { CompareTable } from '../../components/pricing/CompareTable';
import { CompatibilityMatrix } from '../../components/pricing/CompatibilityMatrix';
import { PricingFAQ } from '../../components/pricing/PricingFAQ';
import { LeadForm } from '../../components/pricing/LeadForm';
import { FinalCTA } from '../../components/landing/FinalCTA';
import { createPageMetadata } from '../../lib/site-metadata';

export const metadata = createPageMetadata({
  title: 'Pricing — Threadplane',
  description:
    '@threadplane/chat is free for noncommercial use under PolyForm Noncommercial 1.0.0. Commercial production use requires a Threadplane Commercial license. Other libraries remain MIT.',
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
              Simple, transparent pricing
            </h1>
          </div>
        </Container>
      </Section>

      <CompareTable />

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
