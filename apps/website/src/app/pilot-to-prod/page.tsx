import { tokens } from '@ngaf/design-tokens';
import { Container } from '../../components/ui/Container';
import { Section } from '../../components/ui/Section';
import { Eyebrow } from '../../components/ui/Eyebrow';
import { Button } from '../../components/ui/Button';
import { Pill } from '../../components/ui/Pill';
import { Card } from '../../components/ui/Card';
import { FeatureBlock } from '../../components/landing/FeatureBlock';
import { BrowserFrame } from '../../components/ui/BrowserFrame';
import { WhitePaperBlock } from '../../components/landing/WhitePaperBlock';
import { Promises } from '../../components/landing/Promises';
import { FinalCTA } from '../../components/landing/FinalCTA';
import { createPageMetadata } from '../../lib/site-metadata';

export const metadata = createPageMetadata({
  title: 'Pilot to Production — Agent UI for Angular',
  description: 'Close the last-mile gap. The 3-month pilot engagement is included with every app deployment license. We work alongside your Angular team to ship your first agent to production.',
  pathname: '/pilot-to-prod',
  type: 'website',
});

export default function PilotToProdPage() {
  return (
    <>
      {/* Hero */}
      <Section surface="canvas" ariaLabelledBy="pilot-hero-heading">
        <Container>
          <div style={{ maxWidth: 880, margin: '0 auto', textAlign: 'center' }}>
            <Eyebrow tone="accent" style={{ marginBottom: 16 }}>Pilot to production</Eyebrow>
            <h1
              id="pilot-hero-heading"
              style={{
                fontFamily: tokens.typography.h1.family,
                fontSize: tokens.typography.h1.size,
                lineHeight: tokens.typography.h1.line,
                fontWeight: 700,
                color: tokens.colors.textPrimary,
                margin: 0,
                marginBottom: 24,
                letterSpacing: '-0.02em',
              }}
            >
              8 weeks. One working agent. Production-ready patterns.
            </h1>
            <p
              style={{
                fontFamily: tokens.typography.bodyLg.family,
                fontSize: tokens.typography.bodyLg.size,
                lineHeight: tokens.typography.bodyLg.line,
                color: tokens.colors.textSecondary,
                margin: '0 auto 32px',
                maxWidth: 640,
              }}
            >
              Pilot-to-Prod is a concierge engagement. We ship your first Angular agent on your real data, in your real app — and your engineers own it at the end.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
              <Button variant="primary" size="lg" href="#whitepaper-block">Read the field report</Button>
              <Button variant="secondary" size="lg" href="#contact">Book a discovery call</Button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Pill variant="accent">Fixed scope</Pill>
              <Pill variant="neutral">Source delivered</Pill>
              <Pill variant="neutral">IP yours</Pill>
              <Pill variant="neutral">No lock-in</Pill>
            </div>
          </div>
        </Container>
      </Section>

      {/* Discover */}
      <FeatureBlock
        id="discover"
        eyebrow="Week 1–2 · Discover"
        headline="Map your stack. Pick the work that earns its keep."
        body="We don't start with the model. We start with the workflow — the meeting where someone says 'this would be a great use of AI' and the friction that's stopping it from shipping."
        bullets={[
          'Audit existing Angular surfaces + agent-eligible workflows',
          'Identify the 1–2 highest-leverage agents to build first',
          'Lock down auth, data residency, observability constraints',
          'Decide LangGraph vs AG-UI adapter strategy',
        ]}
        supportingCards={[
          { title: 'Workshops', description: 'On-site or remote with your team.' },
          { title: 'Stack audit', description: 'Existing Angular + backend review.' },
          { title: 'Roadmap', description: 'Concrete scope for build phase.' },
        ]}
        cta={{ label: 'See sample roadmap', href: '#whitepaper-block' }}
        visual={
          <BrowserFrame url="discover · scope · plan" elevation="md">
            <div style={{ padding: 28, minHeight: 320, background: tokens.surfaces.surface }}>
              <Eyebrow tone="accent" style={{ marginBottom: 12 }}>Roadmap draft</Eyebrow>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  ['W1', 'Stakeholder interviews + workflow audit'],
                  ['W2', 'Agent shortlist + integration plan'],
                  ['W3–5', 'Build + iterate on real data'],
                  ['W6–7', 'Harden + observability + deploy'],
                  ['W8', 'Train your team · handoff'],
                ].map(([w, desc]) => (
                  <li key={w} style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                    <span style={{
                      fontFamily: tokens.typography.fontMono,
                      fontSize: 11,
                      color: tokens.colors.accent,
                      fontWeight: 700,
                      flex: '0 0 40px',
                    }}>{w}</span>
                    <span style={{ fontSize: 14, color: tokens.colors.textSecondary }}>{desc}</span>
                  </li>
                ))}
              </ul>
            </div>
          </BrowserFrame>
        }
      />

      {/* Build */}
      <FeatureBlock
        id="build"
        eyebrow="Week 3–5 · Build"
        headline="Ship a working agent on your real data."
        body="Working code, not slideware. We integrate against your real backend, your real auth, and your real Angular app — paired with your engineers, not behind a curtain."
        bullets={[
          'Real LangGraph or AG-UI backend (yours or ours, your call)',
          'Streaming chat surface using @ngaf/chat compositions',
          'Generative UI for the workflows that benefit from it',
          'Daily syncs · weekly demo to stakeholders',
        ]}
        supportingCards={[
          { title: 'Pair programming', description: 'Your engineers drive.' },
          { title: 'Open repo', description: 'You own the source from day one.' },
          { title: 'Weekly demo', description: 'Stakeholder transparency throughout.' },
        ]}
        cta={{ label: 'See @ngaf/chat', href: '/chat' }}
        visualLeft
        visual={
          <BrowserFrame url="cockpit.threadplane.ai" elevation="md">
            <img
              src="/screenshots/cockpit-run.webp"
              alt="Cockpit reference app — live chat surface ready to receive a message"
              style={{ display: 'block', width: '100%', height: 'auto' }}
              loading="lazy"
              decoding="async"
            />
          </BrowserFrame>
        }
      />

      {/* Harden */}
      <FeatureBlock
        id="harden"
        eyebrow="Week 6–7 · Harden"
        headline="Production-ready, not demo-ready."
        body="Observability, error boundaries, fallback strategies, deploy paths, on-call runbook. The stuff that makes the difference between a demo and an app you can leave running on a Friday afternoon."
        bullets={[
          'Observability — tracing, metrics, error budgets',
          'Error/fallback strategy across every agent surface',
          'CI/CD integration with your existing pipeline',
          'Load + chaos testing patterns',
          'On-call runbook handed to your team',
        ]}
        supportingCards={[
          { title: 'Tracing', description: 'OpenTelemetry hooks.' },
          { title: 'Fallback API', description: 'Per-component readiness.' },
          { title: 'Runbook', description: 'Yours forever.' },
        ]}
        cta={{ label: 'Production patterns', href: '/docs/agent/guides/deployment' }}
        visual={
          <BrowserFrame url="grafana · agent dashboard" elevation="md">
            <div style={{ padding: 28, minHeight: 320, background: tokens.surfaces.surface }}>
              <Eyebrow tone="accent" style={{ marginBottom: 12 }}>Production checklist</Eyebrow>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  'Streaming latency budget defined',
                  'Tool-call error boundaries wired',
                  'Fallback API per surface',
                  'Tracing → your dashboard',
                  'On-call runbook delivered',
                  'Deploy + rollback tested',
                ].map((item) => (
                  <li key={item} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14, color: tokens.colors.textSecondary }}>
                    <span style={{
                      width: 18, height: 18, borderRadius: tokens.radius.full,
                      background: tokens.colors.accent, color: tokens.colors.textInverted,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700,
                    }}>✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </BrowserFrame>
        }
      />

      {/* Outcomes */}
      <Section surface="tinted" ariaLabelledBy="outcomes-heading">
        <Container>
          <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center', marginBottom: 48 }}>
            <Eyebrow tone="accent" style={{ marginBottom: 16 }}>What you walk away with</Eyebrow>
            <h2
              id="outcomes-heading"
              style={{
                fontFamily: tokens.typography.h2.family,
                fontSize: tokens.typography.h2.size,
                lineHeight: tokens.typography.h2.line,
                fontWeight: 700,
                color: tokens.colors.textPrimary,
                margin: 0,
                letterSpacing: '-0.015em',
              }}
            >
              A working agent. A trained team. A runbook.
            </h2>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 16,
              maxWidth: 1000,
              margin: '0 auto',
            }}
          >
            {[
              { t: 'Working demo', d: 'Live on your data, in your app — not in a sandbox.' },
              { t: 'Hardened patterns', d: 'Error/fallback/observability built in from the start.' },
              { t: 'Deploy-ready', d: 'Integrated with your CI/CD, your auth, your data.' },
              { t: 'Trained team', d: 'Your engineers own the framework and the runbook.' },
            ].map((o) => (
              <Card key={o.t} padding="lg">
                <h3 style={{
                  fontFamily: tokens.typography.h3.family,
                  fontSize: 17,
                  lineHeight: 1.3,
                  fontWeight: 600,
                  color: tokens.colors.textPrimary,
                  margin: 0,
                  marginBottom: 8,
                }}>
                  {o.t}
                </h3>
                <p style={{
                  fontFamily: tokens.typography.body.family,
                  fontSize: 14,
                  lineHeight: tokens.typography.body.line,
                  color: tokens.colors.textSecondary,
                  margin: 0,
                }}>
                  {o.d}
                </p>
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      <WhitePaperBlock />
      <Promises />

      {/* Contact anchor */}
      <Section id="contact" surface="white" ariaLabelledBy="contact-heading">
        <Container>
          <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
            <Eyebrow tone="accent" style={{ marginBottom: 16 }}>Discovery call</Eyebrow>
            <h2
              id="contact-heading"
              style={{
                fontFamily: tokens.typography.h2.family,
                fontSize: tokens.typography.h2.size,
                lineHeight: tokens.typography.h2.line,
                fontWeight: 700,
                color: tokens.colors.textPrimary,
                margin: 0,
                marginBottom: 16,
                letterSpacing: '-0.015em',
              }}
            >
              Tell us about your stack.
            </h2>
            <p style={{
              fontFamily: tokens.typography.bodyLg.family,
              fontSize: tokens.typography.bodyLg.size,
              lineHeight: tokens.typography.bodyLg.line,
              color: tokens.colors.textSecondary,
              margin: '0 0 32px 0',
            }}>
              30-minute discovery call. We&apos;ll dig into your Angular surface, your agent-eligible workflows, and whether Pilot-to-Prod is the right fit. No pitch deck.
            </p>
            <Button variant="primary" size="lg" href="/pricing#lead-form">
              Request a discovery call
            </Button>
          </div>
        </Container>
      </Section>

      <FinalCTA />
    </>
  );
}
