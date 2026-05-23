import Link from 'next/link';
import { tokens } from '@ngaf/design-tokens';
import { Container } from '../../../components/ui/Container';
import { Section } from '../../../components/ui/Section';
import { Eyebrow } from '../../../components/ui/Eyebrow';
import { Button } from '../../../components/ui/Button';
import { createPageMetadata } from '../../../lib/site-metadata';

export const metadata = createPageMetadata({
  title: 'Licensing — ThreadPlane',
  description:
    'How the ThreadPlane Commercial license works, who needs one, and how to install your license token in @ngaf/chat.',
  pathname: '/docs/licensing',
  type: 'website',
});

const headingStyle = {
  fontFamily: tokens.typography.h2.family,
  fontSize: tokens.typography.h2.size,
  lineHeight: tokens.typography.h2.line,
  fontWeight: 700,
  color: tokens.colors.textPrimary,
  margin: 0,
  marginBottom: 16,
  letterSpacing: '-0.01em',
} as const;

const h3Style = {
  fontFamily: tokens.typography.h3.family,
  fontSize: tokens.typography.h3.size,
  lineHeight: tokens.typography.h3.line,
  fontWeight: 600,
  color: tokens.colors.textPrimary,
  margin: 0,
  marginTop: 24,
  marginBottom: 8,
} as const;

const bodyStyle = {
  fontFamily: tokens.typography.body.family,
  fontSize: tokens.typography.body.size,
  lineHeight: tokens.typography.body.line,
  color: tokens.colors.textSecondary,
  margin: '0 0 16px',
  maxWidth: '64ch',
} as const;

const codeBlockStyle = {
  fontFamily: tokens.typography.fontMono,
  fontSize: 13,
  lineHeight: 1.6,
  background: tokens.surfaces.surfaceTinted,
  border: `1px solid ${tokens.surfaces.border}`,
  borderRadius: 8,
  padding: 16,
  overflow: 'auto',
  color: tokens.colors.textPrimary,
  margin: '0 0 16px',
  whiteSpace: 'pre' as const,
} as const;

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse' as const,
  fontFamily: tokens.typography.body.family,
  fontSize: 14,
  color: tokens.colors.textSecondary,
  margin: '0 0 24px',
} as const;

const cellStyle = {
  padding: '10px 12px',
  borderBottom: `1px solid ${tokens.surfaces.border}`,
  verticalAlign: 'top' as const,
} as const;

const headerCellStyle = {
  ...cellStyle,
  color: tokens.colors.textPrimary,
  fontWeight: 600,
  background: tokens.surfaces.surfaceTinted,
} as const;

export default function LicensingPage() {
  return (
    <>
      <Section surface="canvas" ariaLabelledBy="licensing-heading">
        <Container>
          <div style={{ maxWidth: 720 }}>
            <Eyebrow tone="accent" style={{ marginBottom: 16 }}>Documentation</Eyebrow>
            <h1
              id="licensing-heading"
              style={{
                fontFamily: tokens.typography.h1.family,
                fontSize: tokens.typography.h1.size,
                lineHeight: tokens.typography.h1.line,
                fontWeight: 700,
                color: tokens.colors.textPrimary,
                margin: 0,
                marginBottom: 16,
                letterSpacing: '-0.02em',
              }}
            >
              Licensing
            </h1>
            <p
              style={{
                fontFamily: tokens.typography.bodyLg.family,
                fontSize: tokens.typography.bodyLg.size,
                lineHeight: tokens.typography.bodyLg.line,
                color: tokens.colors.textSecondary,
                margin: 0,
                maxWidth: '60ch',
              }}
            >
              How the ThreadPlane licensing model works, who needs a paid license, and how to install your license token.
            </p>
          </div>
        </Container>
      </Section>

      <Section surface="canvas">
        <Container>
          <div style={{ maxWidth: 760 }}>
            <h2 style={headingStyle}>The model</h2>
            <p style={bodyStyle}>
              Agent UI for Angular is a suite of libraries. Most are{' '}
              <strong style={{ color: tokens.colors.textPrimary }}>MIT-licensed</strong> and free for any use,
              commercial or not. Only <code style={{ fontFamily: tokens.typography.fontMono }}>@ngaf/chat</code> is
              dual-licensed.
            </p>
            <p style={bodyStyle}>
              <code style={{ fontFamily: tokens.typography.fontMono }}>@ngaf/chat</code> is source-available under{' '}
              <strong style={{ color: tokens.colors.textPrimary }}>PolyForm Noncommercial 1.0.0</strong> for free
              noncommercial use, or a <strong style={{ color: tokens.colors.textPrimary }}>ThreadPlane Commercial license</strong>{' '}
              for production use inside a for-profit context. The same source ships under both — you don't get a
              different build.
            </p>

            <h3 style={h3Style}>Do you need a paid license?</h3>
            <p style={bodyStyle}>
              You need a ThreadPlane Commercial license if you use <code style={{ fontFamily: tokens.typography.fontMono }}>@ngaf/chat</code>{' '}
              in any of:
            </p>
            <ul style={{ ...bodyStyle, paddingLeft: 24 }}>
              <li>A commercial product or SaaS</li>
              <li>An internal business tool inside a for-profit company</li>
              <li>An agency deliverable or paid client project</li>
              <li>Any application operated by or for a for-profit entity</li>
            </ul>
            <p style={bodyStyle}>You do <strong style={{ color: tokens.colors.textPrimary }}>not</strong> need a paid license for:</p>
            <ul style={{ ...bodyStyle, paddingLeft: 24 }}>
              <li>Personal, hobby, student, academic, or nonprofit projects</li>
              <li>Public demos and tutorials</li>
              <li>Open-source applications released under an OSI-approved license</li>
              <li>Commercial evaluation, up to 30 calendar days from your first commercial use</li>
            </ul>
          </div>
        </Container>
      </Section>

      <Section surface="canvas">
        <Container>
          <div style={{ maxWidth: 760 }}>
            <h2 style={headingStyle}>Install your license</h2>
            <p style={bodyStyle}>
              After purchase, ThreadPlane emails a signed license token to the address on your receipt. Paste it
              into your app's <code style={{ fontFamily: tokens.typography.fontMono }}>provideChat()</code>{' '}
              configuration:
            </p>
            <pre style={codeBlockStyle}>{`// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideChat } from '@ngaf/chat';

export const appConfig: ApplicationConfig = {
  providers: [
    provideChat({
      license: process.env['THREADPLANE_LICENSE'],
    }),
  ],
};`}</pre>
            <p style={bodyStyle}>
              The library verifies the token's Ed25519 signature on boot. The check is{' '}
              <strong style={{ color: tokens.colors.textPrimary }}>advisory-only</strong>: a missing, expired, or
              tampered token logs a <code style={{ fontFamily: tokens.typography.fontMono }}>console.warn</code> but
              never blocks rendering. Verification is fully offline; no calls leave your app at runtime.
            </p>
            <p style={bodyStyle}>
              The token is safe to commit to a private repository, or to read from a build-time environment variable
              for public repos. Public-repo demos are exempt from the commercial-use definition, but if your
              public repo backs a commercial product, the deployed bundle does need a license.
            </p>
          </div>
        </Container>
      </Section>

      <Section surface="canvas">
        <Container>
          <div style={{ maxWidth: 900 }}>
            <h2 style={headingStyle}>Tier scoping</h2>
            <p style={bodyStyle}>
              Pick the tier that matches how you'll deploy. All paid tiers grant the same{' '}
              ThreadPlane Commercial license; the difference is the scope of use and the number of seats.
            </p>
            <div style={{ overflow: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={headerCellStyle}>Tier</th>
                    <th style={headerCellStyle}>Developers</th>
                    <th style={headerCellStyle}>Best for</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={cellStyle}><strong style={{ color: tokens.colors.textPrimary }}>Developer Seat</strong> — $299/dev/yr</td>
                    <td style={cellStyle}>Per seat</td>
                    <td style={cellStyle}>Solo devs, growing teams</td>
                  </tr>
                  <tr>
                    <td style={cellStyle}><strong style={{ color: tokens.colors.textPrimary }}>Team</strong> — $1,495/yr</td>
                    <td style={cellStyle}>5 seats included</td>
                    <td style={cellStyle}>Small teams that want a single SKU and renewal</td>
                  </tr>
                  <tr>
                    <td style={cellStyle}><strong style={{ color: tokens.colors.textPrimary }}>Enterprise</strong> — from $4,000/mo</td>
                    <td style={cellStyle}>Custom</td>
                    <td style={cellStyle}>SLA, security review, Pilot-to-Prod engagement, Slack Connect</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p style={{ ...bodyStyle, fontSize: 13, color: tokens.colors.textMuted }}>
              Every license is valid for 12 months from the date of purchase. Renewal is a fresh annual purchase —
              we don't auto-charge.
            </p>
          </div>
        </Container>
      </Section>

      <Section surface="canvas">
        <Container>
          <div style={{ maxWidth: 760 }}>
            <h2 style={headingStyle}>Evaluation</h2>
            <p style={bodyStyle}>
              You may use <code style={{ fontFamily: tokens.typography.fontMono }}>@ngaf/chat</code> commercially
              for <strong style={{ color: tokens.colors.textPrimary }}>30 calendar days</strong> from your first
              commercial use as a good-faith evaluation. There is no telemetry, no registration, no email check —
              we trust you to count the days. After 30 days you must either purchase a license or stop the
              commercial use.
            </p>

            <h2 style={{ ...headingStyle, marginTop: 32 }}>Refunds</h2>
            <p style={bodyStyle}>
              If you refund a license through Stripe, the token is revoked automatically and we email a confirmation.
              The verification check warns on boot. There's no clawback of the source code you already have —
              everything is source-available under PolyForm Noncommercial by default.
            </p>

            <h2 style={{ ...headingStyle, marginTop: 32 }}>Questions</h2>
            <p style={bodyStyle}>
              Volume pricing, multi-app licensing, audit clauses, custom terms — any of those, reach out and we'll
              work it out.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
              <Button variant="primary" size="md" href="/pricing">
                See pricing
              </Button>
              <Button variant="ghost" size="md" href="/contact">
                Contact us
              </Button>
              <Link
                href="/pricing#faq"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  fontFamily: tokens.typography.body.family,
                  fontSize: 14,
                  color: tokens.colors.accent,
                  textDecoration: 'none',
                  padding: '8px 12px',
                }}
              >
                Pricing FAQ →
              </Link>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
