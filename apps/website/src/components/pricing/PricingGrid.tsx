import { tokens } from '@ngaf/design-tokens';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Eyebrow } from '../ui/Eyebrow';

interface Plan {
  name: string;
  price: string;
  period: string;
  features: string[];
  highlight: boolean;
  cta: string;
  ctaHref: string;
  ctaExternal?: boolean;
}

const PLANS: Plan[] = [
  {
    name: 'Open Source',
    price: 'Free',
    period: 'forever',
    features: ['MIT License', 'All libraries', 'Commercial use welcome', 'Community support'],
    highlight: false,
    cta: 'Get Started',
    ctaHref: 'https://www.npmjs.com/package/@ngaf/langgraph',
    ctaExternal: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: 'contact for details',
    features: ['Priority support', 'SLA', 'Managed service (coming soon)', 'Custom contract'],
    highlight: true,
    cta: 'Contact Us',
    ctaHref: '#lead-form',
  },
];

export function PricingGrid() {
  return (
    <Section surface="canvas">
      <Container>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
            maxWidth: 800,
            margin: '0 auto',
          }}
        >
          {PLANS.map((plan) => (
            <Card
              key={plan.name}
              padding="lg"
              surface={plan.highlight ? 'dim' : 'white'}
              style={{
                display: 'flex',
                flexDirection: 'column',
                border: plan.highlight
                  ? `2px solid ${tokens.colors.accent}`
                  : `1px solid ${tokens.surfaces.border}`,
              }}
            >
              <Eyebrow tone="accent" style={{ marginBottom: 12 }}>{plan.name}</Eyebrow>
              <p
                style={{
                  fontFamily: tokens.typography.fontSerif,
                  fontWeight: 700,
                  fontSize: 48,
                  color: tokens.colors.textPrimary,
                  lineHeight: 1,
                  marginBottom: 4,
                  marginTop: 0,
                }}
              >
                {plan.price}
              </p>
              <p
                style={{
                  fontSize: 14,
                  color: tokens.colors.textMuted,
                  marginBottom: 24,
                  marginTop: 0,
                }}
              >
                {plan.period}
              </p>
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: '0 0 24px 0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  flex: 1,
                }}
              >
                {plan.features.map((f) => (
                  <li
                    key={f}
                    style={{
                      fontSize: 14,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      color: tokens.colors.textSecondary,
                    }}
                  >
                    <span style={{ color: tokens.colors.accent, fontWeight: 700 }}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <Button
                variant={plan.highlight ? 'primary' : 'secondary'}
                size="md"
                href={plan.ctaHref}
                {...(plan.ctaExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {plan.cta}
              </Button>
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  );
}
