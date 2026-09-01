import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import { Button } from '../ui/Button';

const TIMELINE = [
  { phase: '01', title: 'Discover', body: 'Map your stack, surfaces, and the agentic work that earns its keep.' },
  { phase: '02', title: 'Build', body: 'A working demo on your real data, in your real app.' },
  { phase: '03', title: 'Harden', body: 'Observability, error boundaries, deploy paths, on-call patterns.' },
  { phase: '04', title: 'Train', body: 'Your team owns the stack. We leave you with a runbook, not a black box.' },
];

const OUTCOMES = [
  { claim: 'A working agent demo on your domain', tail: 'your data' },
  { claim: 'Hardened error, fallback, observability patterns', tail: 'production-ready' },
  { claim: 'Deploy-ready integration', tail: 'your CI/CD' },
  { claim: 'Team trained on the framework', tail: 'runbook, yours' },
];

export function PilotBlock() {
  return (
    <Section surface="tinted" ariaLabelledBy="pilot-heading">
      <Container>
        <div className="pilot-block-grid">
          <div>
            <div className="pilot-rail">
              <Eyebrow tone="accent" className="pilot-eyebrow">For teams</Eyebrow>
              <span className="pilot-rail-line" aria-hidden="true" />
            </div>
            <h2 id="pilot-heading" className="pilot-heading">
              Ship your first Angular agent in 8 weeks.
            </h2>
            <p className="pilot-subhead">
              Pilot-to-Prod is a concierge delivery — concrete outcomes, your engineers in the driver&apos;s seat, no lock-in.
            </p>
            <div className="pilot-rows">
              {OUTCOMES.map((o) => (
                <div className="pilot-row" key={o.claim}>
                  <p className="pilot-row-claim">{o.claim}</p>
                  <p className="pilot-row-tail">{o.tail}</p>
                </div>
              ))}
            </div>
            <div className="pilot-cta-row">
              <Button variant="primary" size="lg" href="/pilot-to-prod">See the program</Button>
              <Button variant="secondary" size="lg" href="/pilot-to-prod#contact">Book a call</Button>
            </div>
          </div>

          {/* Timeline */}
          <div className="pilot-steps">
            {TIMELINE.map((t) => (
              <div className="pilot-step" key={t.phase}>
                <span className="pilot-step-num" aria-hidden="true">{t.phase}</span>
                <div>
                  <div className="pilot-step-title">{t.title}</div>
                  <div className="pilot-step-body">{t.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}
