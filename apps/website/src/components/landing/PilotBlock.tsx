import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

const TIMELINE = [
  { phase: '1', title: 'Discover', body: 'Map your stack, surfaces, and the agentic work that earns its keep.' },
  { phase: '2', title: 'Build', body: 'Ship a working demo on your real data, in your real Angular app.' },
  { phase: '3', title: 'Harden', body: 'Observability, error boundaries, deploy paths, on-call patterns.' },
  { phase: '4', title: 'Train', body: 'Your team owns the stack. We leave you with a runbook, not a black box.' },
];

const OUTCOMES = [
  'Working agent demo on your domain',
  'Hardened production patterns (error/fallback/observability)',
  'Deploy-ready integration with your CI/CD',
  'Team trained on the framework + LangGraph',
];

export function PilotBlock() {
  return (
    <Section surface="tinted" ariaLabelledBy="pilot-heading">
      <Container>
        <div className="pilot-block-grid">
          <div>
            <Eyebrow tone="accent" className="pilot-eyebrow">For teams</Eyebrow>
            <h2 id="pilot-heading" className="pilot-heading">
              Ship your first Angular agent in 8 weeks.
            </h2>
            <p className="pilot-subhead">
              Pilot-to-Prod is a concierge delivery — concrete outcomes, your engineers in the driver&apos;s seat, no lock-in.
            </p>
            <ul className="pilot-outcomes">
              {OUTCOMES.map((o) => (
                <li key={o} className="pilot-outcome">
                  <span aria-hidden="true" className="pilot-outcome-check">
                    ✓
                  </span>
                  <span>{o}</span>
                </li>
              ))}
            </ul>
            <div className="pilot-cta-row">
              <Button variant="primary" size="lg" href="/pilot-to-prod">See the program</Button>
              <Button variant="secondary" size="lg" href="/pilot-to-prod#contact">Book a call</Button>
            </div>
          </div>

          {/* Timeline */}
          <div className="pilot-timeline">
            {TIMELINE.map((t) => (
              <Card key={t.phase} padding="md">
                <div className="pilot-timeline-row">
                  <div className="pilot-timeline-phase">
                    {t.phase}
                  </div>
                  <div>
                    <div className="pilot-timeline-title">
                      {t.title}
                    </div>
                    <div className="pilot-timeline-body">
                      {t.body}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}
