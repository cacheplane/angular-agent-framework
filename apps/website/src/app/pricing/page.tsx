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
    'Every Threadplane package is MIT-licensed. Add Production Assurance or enterprise delivery for expert support in your own stack.',
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
              Use the complete framework in commercial products, internal tools, and client work.
              Add expert support when you need response commitments, architecture guidance, or
              hands-on delivery.
            </p>
            <p className="pricing-page-license-line">
              <span>Every package is MIT</span>
              <span aria-hidden="true">·</span>
              <span>Commercial use without registration or runtime checks</span>
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
