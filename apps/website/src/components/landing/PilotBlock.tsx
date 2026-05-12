import { tokens } from '@ngaf/design-tokens';
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
        <div
          className="pilot-block-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: 64,
            alignItems: 'center',
          }}
        >
          <div>
            <Eyebrow tone="accent" style={{ marginBottom: 16 }}>For teams</Eyebrow>
            <h2
              id="pilot-heading"
              style={{
                fontFamily: tokens.typography.h2.family,
                fontSize: tokens.typography.h2.size,
                lineHeight: tokens.typography.h2.line,
                fontWeight: 700,
                color: tokens.colors.textPrimary,
                margin: 0,
                marginBottom: 20,
                letterSpacing: '-0.015em',
              }}
            >
              Ship your first Angular agent in 8 weeks.
            </h2>
            <p
              style={{
                fontFamily: tokens.typography.bodyLg.family,
                fontSize: tokens.typography.bodyLg.size,
                lineHeight: tokens.typography.bodyLg.line,
                color: tokens.colors.textSecondary,
                margin: 0,
                marginBottom: 24,
              }}
            >
              Pilot-to-Prod is a concierge delivery — concrete outcomes, your engineers in the driver&apos;s seat, no lock-in.
            </p>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: '0 0 32px 0',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {OUTCOMES.map((o) => (
                <li
                  key={o}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    fontFamily: tokens.typography.body.family,
                    fontSize: tokens.typography.body.size,
                    lineHeight: tokens.typography.body.line,
                    color: tokens.colors.textPrimary,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      flex: '0 0 18px',
                      height: 18,
                      marginTop: 4,
                      borderRadius: tokens.radius.full,
                      background: tokens.colors.accent,
                      color: tokens.colors.textInverted,
                      fontSize: 11,
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 1,
                    }}
                  >
                    ✓
                  </span>
                  <span>{o}</span>
                </li>
              ))}
            </ul>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Button variant="primary" size="lg" href="/pilot-to-prod">See the program</Button>
              <Button variant="secondary" size="lg" href="/pilot-to-prod#contact">Book a call</Button>
            </div>
          </div>

          {/* Timeline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {TIMELINE.map((t) => (
              <Card key={t.phase} padding="md">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  <div
                    style={{
                      flex: '0 0 36px',
                      height: 36,
                      borderRadius: tokens.radius.full,
                      background: tokens.colors.accent,
                      color: tokens.colors.textInverted,
                      fontFamily: tokens.typography.fontMono,
                      fontSize: 14,
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {t.phase}
                  </div>
                  <div>
                    <div
                      style={{
                        fontFamily: tokens.typography.fontSans,
                        fontSize: 17,
                        fontWeight: 600,
                        color: tokens.colors.textPrimary,
                        marginBottom: 4,
                      }}
                    >
                      {t.title}
                    </div>
                    <div
                      style={{
                        fontFamily: tokens.typography.body.family,
                        fontSize: tokens.typography.body.size,
                        lineHeight: tokens.typography.body.line,
                        color: tokens.colors.textSecondary,
                      }}
                    >
                      {t.body}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <style>{`
          @media (max-width: 900px) {
            .pilot-block-grid {
              grid-template-columns: 1fr !important;
              gap: 40px !important;
            }
          }
        `}</style>
      </Container>
    </Section>
  );
}
