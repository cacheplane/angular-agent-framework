import Link from 'next/link';
import { Container } from '../../../components/ui/Container';
import { Section } from '../../../components/ui/Section';
import { Eyebrow } from '../../../components/ui/Eyebrow';
import { Button } from '../../../components/ui/Button';
import { createPageMetadata } from '../../../lib/site-metadata';

export const metadata = createPageMetadata({
  title: 'Licensing — Threadplane',
  description:
    'How the Threadplane Commercial license works, who needs one, and how to install your license token in @threadplane/chat.',
  pathname: '/docs/licensing',
  type: 'website',
});

export default function LicensingPage() {
  return (
    <>
      <Section surface="canvas" ariaLabelledBy="licensing-heading">
        <Container>
          <div className="licensing-hero-inner">
            <Eyebrow tone="accent" className="licensing-eyebrow-spaced">Documentation</Eyebrow>
            <h1 id="licensing-heading" className="licensing-h1">
              Licensing
            </h1>
            <p className="licensing-subtitle">
              How the Threadplane licensing model works, who needs a paid license, and how to install your license token.
            </p>
          </div>
        </Container>
      </Section>

      <Section surface="canvas">
        <Container>
          <div className="licensing-section-inner">
            <h2 className="licensing-h2">The model</h2>
            <p className="licensing-body">
              Threadplane is a suite of libraries. Most are{' '}
              <strong className="licensing-strong">MIT-licensed</strong> and free for any use,
              commercial or not. Only <code className="licensing-code-inline">@threadplane/chat</code> is
              dual-licensed.
            </p>
            <p className="licensing-body">
              <code className="licensing-code-inline">@threadplane/chat</code> is source-available under{' '}
              <strong className="licensing-strong">PolyForm Noncommercial 1.0.0</strong> for free
              noncommercial use, or a <strong className="licensing-strong">Threadplane Commercial license</strong>{' '}
              for production use inside a for-profit context. The same source ships under both — you don't get a
              different build.
            </p>

            <h3 className="licensing-h3">Do you need a paid license?</h3>
            <p className="licensing-body">
              You need a Threadplane Commercial license if you use <code className="licensing-code-inline">@threadplane/chat</code>{' '}
              in any of:
            </p>
            <ul className="licensing-body licensing-list">
              <li>A commercial product or SaaS</li>
              <li>An internal business tool inside a for-profit company</li>
              <li>An agency deliverable or paid client project</li>
              <li>Any application operated by or for a for-profit entity</li>
            </ul>
            <p className="licensing-body">You do <strong className="licensing-strong">not</strong> need a paid license for:</p>
            <ul className="licensing-body licensing-list">
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
          <div className="licensing-section-inner">
            <h2 className="licensing-h2">Install your license</h2>
            <p className="licensing-body">
              After purchase, Threadplane emails a signed license token to the address on your receipt. Paste it
              into your app's <code className="licensing-code-inline">provideChat()</code>{' '}
              configuration:
            </p>
            <pre className="licensing-code-block">{`// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideChat } from '@threadplane/chat';

export const appConfig: ApplicationConfig = {
  providers: [
    provideChat({
      license: process.env['THREADPLANE_LICENSE'],
    }),
  ],
};`}</pre>
            <p className="licensing-body">
              The library verifies the token's Ed25519 signature on boot. The check is{' '}
              <strong className="licensing-strong">advisory-only</strong>: a missing, expired, or
              tampered token logs a <code className="licensing-code-inline">console.warn</code> but
              never blocks rendering. Verification is fully offline; no calls leave your app at runtime.
            </p>
            <p className="licensing-body">
              The token is safe to commit to a private repository, or to read from a build-time environment variable
              for public repos. Public-repo demos are exempt from the commercial-use definition, but if your
              public repo backs a commercial product, the deployed bundle does need a license.
            </p>
          </div>
        </Container>
      </Section>

      <Section surface="canvas">
        <Container>
          <div className="licensing-section-inner licensing-section-inner-wide">
            <h2 className="licensing-h2">Tier scoping</h2>
            <p className="licensing-body">
              Pick the tier that matches how you'll deploy. All paid tiers grant the same{' '}
              Threadplane Commercial license; the difference is the scope of use and the number of seats.
            </p>
            <div className="licensing-table-scroll">
              <table className="licensing-table">
                <thead>
                  <tr>
                    <th className="licensing-cell licensing-header-cell">Tier</th>
                    <th className="licensing-cell licensing-header-cell">Developers</th>
                    <th className="licensing-cell licensing-header-cell">Best for</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="licensing-cell"><strong className="licensing-strong">Developer Seat</strong> — $29/dev/mo or $299/dev/yr</td>
                    <td className="licensing-cell">Per seat</td>
                    <td className="licensing-cell">Solo devs, growing teams</td>
                  </tr>
                  <tr>
                    <td className="licensing-cell"><strong className="licensing-strong">Team</strong> — $149/mo or $1,495/yr</td>
                    <td className="licensing-cell">5 seats included</td>
                    <td className="licensing-cell">Small teams that want a single SKU and renewal</td>
                  </tr>
                  <tr>
                    <td className="licensing-cell"><strong className="licensing-strong">Enterprise</strong> — from $4,000/mo</td>
                    <td className="licensing-cell">Custom</td>
                    <td className="licensing-cell">SLA, security review, Pilot-to-Prod engagement, Slack Connect</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="licensing-body licensing-footnote">
              Paid tiers are recurring subscriptions. Annual saves ~15% vs monthly. Cancel anytime — the license
              stays valid through the end of the current paid period.
            </p>
          </div>
        </Container>
      </Section>

      <Section surface="canvas">
        <Container>
          <div className="licensing-section-inner">
            <h2 className="licensing-h2">Evaluation</h2>
            <p className="licensing-body">
              You may use <code className="licensing-code-inline">@threadplane/chat</code> commercially
              for <strong className="licensing-strong">30 calendar days</strong> from your first
              commercial use as a good-faith evaluation. There is no telemetry, no registration, no email check —
              we trust you to count the days. After 30 days you must either purchase a license or stop the
              commercial use.
            </p>

            <h2 className="licensing-h2 licensing-h2-spaced">Refunds</h2>
            <p className="licensing-body">
              If you refund a license through Stripe, the token is revoked automatically and we email a confirmation.
              The verification check warns on boot. There's no clawback of the source code you already have —
              everything is source-available under PolyForm Noncommercial by default.
            </p>

            <h2 className="licensing-h2 licensing-h2-spaced">Questions</h2>
            <p className="licensing-body">
              Volume pricing, multi-app licensing, audit clauses, custom terms — any of those, reach out and we'll
              work it out.
            </p>
            <div className="licensing-cta-row">
              <Button variant="primary" size="md" href="/pricing">
                See pricing
              </Button>
              <Button variant="ghost" size="md" href="/contact">
                Contact us
              </Button>
              <Link href="/pricing#faq" className="licensing-faq-link">
                Pricing FAQ →
              </Link>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
