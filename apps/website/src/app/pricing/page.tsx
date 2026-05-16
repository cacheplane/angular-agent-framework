import { tokens } from '@ngaf/design-tokens';
import { Container } from '../../components/ui/Container';
import { Section } from '../../components/ui/Section';
import { Eyebrow } from '../../components/ui/Eyebrow';
import { PricingGrid } from '../../components/pricing/PricingGrid';
import { CompareTable } from '../../components/pricing/CompareTable';
import { LeadForm } from '../../components/pricing/LeadForm';
import { FinalCTA } from '../../components/landing/FinalCTA';

export const metadata = {
  title: 'Pricing — Agent UI for Angular',
  description: 'Simple, transparent pricing. MIT-licensed libraries are free forever. Enterprise contracts available.',
};

export default function PricingPage() {
  return (
    <>
      <Section surface="canvas" ariaLabelledBy="pricing-heading">
        <Container>
          <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto' }}>
            <Eyebrow tone="accent" style={{ marginBottom: 16 }}>Pricing</Eyebrow>
            <h1
              id="pricing-heading"
              style={{
                fontFamily: tokens.typography.h1.family,
                fontWeight: 700,
                fontSize: tokens.typography.h1.size,
                lineHeight: tokens.typography.h1.line,
                color: tokens.colors.textPrimary,
                margin: 0,
                marginBottom: 16,
                letterSpacing: '-0.02em',
              }}
            >
              Simple, transparent pricing.
            </h1>
            <p
              style={{
                fontFamily: tokens.typography.bodyLg.family,
                fontSize: tokens.typography.bodyLg.size,
                lineHeight: tokens.typography.bodyLg.line,
                color: tokens.colors.textSecondary,
                margin: 0,
              }}
            >
              MIT-licensed libraries are free forever. Enterprise contracts available for teams that want priority support and an SLA.
            </p>
          </div>
        </Container>
      </Section>
      <PricingGrid />
      <CompareTable />
      <LeadForm />
      <FinalCTA />
    </>
  );
}
