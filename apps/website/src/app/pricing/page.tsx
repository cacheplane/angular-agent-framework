import { tokens } from '@ngaf/design-tokens';
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
  title: 'Pricing — Agent UI for Angular',
  description:
    '@ngaf/chat is free for noncommercial use under PolyForm Noncommercial 1.0.0. Commercial production use requires a ThreadPlane Commercial license. Other libraries remain MIT.',
  pathname: '/pricing',
  type: 'website',
});

function SmallNote({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: tokens.typography.body.family,
        fontSize: 13,
        lineHeight: 1.6,
        color: tokens.colors.textMuted,
        textAlign: 'center',
        margin: '0 auto',
        maxWidth: 720,
      }}
    >
      {children}
    </p>
  );
}

export default function PricingPage() {
  return (
    <>
      <Section surface="canvas" tight ariaLabelledBy="pricing-heading">
        <Container>
          <div style={{ textAlign: 'center', maxWidth: 760, margin: '0 auto' }}>
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
                letterSpacing: '-0.02em',
              }}
            >
              Simple, transparent pricing
            </h1>
          </div>
        </Container>
      </Section>

      <CompareTable />

      <Section surface="canvas">
        <Container>
          <Eyebrow style={{ marginBottom: 12 }}>Compatibility</Eyebrow>
          <h2
            style={{
              fontFamily: tokens.typography.h2.family,
              fontSize: tokens.typography.h2.size,
              margin: 0,
              marginBottom: 16,
              color: tokens.colors.textPrimary,
            }}
          >
            Angular version support
          </h2>
          <p
            style={{
              margin: 0,
              marginBottom: 24,
              color: tokens.colors.textSecondary,
              maxWidth: '60ch',
            }}
          >
            We ship against the versions our CI tests. Other versions may work but aren&apos;t guaranteed.
          </p>
          <CompatibilityMatrix />
        </Container>
      </Section>

      <PricingFAQ />

      <Section surface="canvas">
        <Container>
          <SmallNote>
            Because commercial use requires a license, <code style={{ fontFamily: tokens.typography.fontMono }}>@ngaf/chat</code> is source-available rather than OSI open source. ThreadPlane keeps ecosystem packages (<code style={{ fontFamily: tokens.typography.fontMono }}>@ngaf/render</code>, <code style={{ fontFamily: tokens.typography.fontMono }}>@ngaf/agent</code>, <code style={{ fontFamily: tokens.typography.fontMono }}>@ngaf/langgraph</code>, <code style={{ fontFamily: tokens.typography.fontMono }}>@ngaf/ag-ui</code>, <code style={{ fontFamily: tokens.typography.fontMono }}>@ngaf/a2ui</code>, <code style={{ fontFamily: tokens.typography.fontMono }}>@ngaf/licensing</code>, <code style={{ fontFamily: tokens.typography.fontMono }}>@ngaf/telemetry</code>, <code style={{ fontFamily: tokens.typography.fontMono }}>@ngaf/design-tokens</code>) permissively MIT-licensed.
          </SmallNote>
        </Container>
      </Section>

      <LeadForm />
      <FinalCTA />
    </>
  );
}
