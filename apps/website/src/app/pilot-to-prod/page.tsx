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
  title: 'Pilot to Production — Threadplane',
  description: 'An optionally scoped eight-week concierge engagement for Angular teams shipping an agent into production with their own runtime, data, and infrastructure.',
  pathname: '/pilot-to-prod',
  type: 'website',
});

export default function PilotToProdPage() {
  return (
    <>
      {/* Hero */}
      <Section surface="canvas" ariaLabelledBy="pilot-hero-heading">
        <Container>
          <div className="pilot-hero-inner">
            <Eyebrow tone="accent" className="pilot-eyebrow-spaced">Pilot to production</Eyebrow>
            <h1 id="pilot-hero-heading" className="pilot-h1">
              8 weeks. One working agent. Production-ready patterns.
            </h1>
            <p className="pilot-hero-subtitle">
              Pilot-to-Prod is a concierge engagement. We ship your first Angular agent on your real data, in your real app — and your engineers own it at the end.
            </p>
            <div className="pilot-hero-buttons">
              <Button variant="primary" size="lg" href="#whitepaper-block">Read the field report</Button>
              <Button variant="secondary" size="lg" href="#contact">Book a discovery call</Button>
            </div>
            <div className="pilot-hero-pills">
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
            <div className="pilot-visual-panel">
              <Eyebrow tone="accent" className="pilot-eyebrow-tight">Roadmap draft</Eyebrow>
              <ul className="pilot-roadmap-list">
                {[
                  ['W1', 'Stakeholder interviews + workflow audit'],
                  ['W2', 'Agent shortlist + integration plan'],
                  ['W3–5', 'Build + iterate on real data'],
                  ['W6–7', 'Harden + observability + deploy'],
                  ['W8', 'Train your team · handoff'],
                ].map(([w, desc]) => (
                  <li key={w} className="pilot-roadmap-item">
                    <span className="pilot-roadmap-week">{w}</span>
                    <span className="pilot-roadmap-desc">{desc}</span>
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
          'Streaming chat surface using @threadplane/chat compositions',
          'Generative UI for the workflows that benefit from it',
          'Daily syncs · weekly demo to stakeholders',
        ]}
        supportingCards={[
          { title: 'Pair programming', description: 'Your engineers drive.' },
          { title: 'Open repo', description: 'You own the source from day one.' },
          { title: 'Weekly demo', description: 'Stakeholder transparency throughout.' },
        ]}
        cta={{ label: 'See @threadplane/chat', href: '/chat' }}
        visualLeft
        visual={
          <BrowserFrame url="cockpit.threadplane.ai" elevation="md">
            <img
              src="/screenshots/cockpit-run.webp"
              alt="Cockpit reference app — live chat surface ready to receive a message"
              className="pilot-screenshot"
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
        cta={{ label: 'Production patterns', href: '/docs/langgraph/guides/deployment' }}
        visual={
          <BrowserFrame url="grafana · agent dashboard" elevation="md">
            <div className="pilot-visual-panel">
              <Eyebrow tone="accent" className="pilot-eyebrow-tight">Production checklist</Eyebrow>
              <ul className="pilot-checklist-list">
                {[
                  'Streaming latency budget defined',
                  'Tool-call error boundaries wired',
                  'Fallback API per surface',
                  'Tracing → your dashboard',
                  'On-call runbook delivered',
                  'Deploy + rollback tested',
                ].map((item) => (
                  <li key={item} className="pilot-checklist-item">
                    <span className="pilot-checklist-badge">✓</span>
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
          <div className="pilot-section-header">
            <Eyebrow tone="accent" className="pilot-eyebrow-spaced">What you walk away with</Eyebrow>
            <h2 id="outcomes-heading" className="pilot-h2">
              A working agent. A trained team. A runbook.
            </h2>
          </div>
          <div className="pilot-outcomes-grid">
            {[
              { t: 'Working demo', d: 'Live on your data, in your app — not in a sandbox.' },
              { t: 'Hardened patterns', d: 'Error/fallback/observability built in from the start.' },
              { t: 'Deploy-ready', d: 'Integrated with your CI/CD, your auth, your data.' },
              { t: 'Trained team', d: 'Your engineers own the framework and the runbook.' },
            ].map((o) => (
              <Card key={o.t} padding="lg">
                <h3 className="pilot-outcome-h3">
                  {o.t}
                </h3>
                <p className="pilot-outcome-body">
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
          <div className="pilot-contact-inner">
            <Eyebrow tone="accent" className="pilot-eyebrow-spaced">Discovery call</Eyebrow>
            <h2 id="contact-heading" className="pilot-h2 pilot-h2-spaced">
              Tell us about your stack.
            </h2>
            <p className="pilot-contact-body">
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
