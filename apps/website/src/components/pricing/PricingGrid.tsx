'use client';

import { tokens } from '@ngaf/design-tokens';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Eyebrow } from '../ui/Eyebrow';
import { trackCtaClick } from '../../lib/analytics/client';
import type { CtaId } from '../../lib/analytics/events';

interface Plan {
  name: string;
  price: string;
  period: string;
  features: readonly string[];
  highlight: boolean;
  cta: string;
  ctaHref: string;
  ctaId: CtaId;
  ctaExternal?: boolean;
}

const PLANS: readonly Plan[] = [
  {
    name: 'Community / Noncommercial',
    price: 'Free',
    period: 'forever',
    features: [
      'Personal, student, academic, nonprofit, demo',
      'Source access',
      'Noncommercial use',
      'Commercial evaluation (30 days)',
      'License: PolyForm Noncommercial 1.0.0',
    ],
    highlight: false,
    cta: 'Start free',
    ctaHref: 'https://www.npmjs.com/package/@ngaf/chat',
    ctaId: 'pricing_tier_community',
    ctaExternal: true,
  },
  {
    name: 'Indie Commercial',
    price: '$149',
    period: '/year',
    features: [
      '1 developer',
      '1 commercial app',
      'Unlimited end users',
      'Commercial license',
      'Best for: solo devs, indie products, consultants with one app',
    ],
    highlight: false,
    cta: 'Buy indie license',
    ctaHref: '/contact?source=pricing_tier_indie',
    ctaId: 'pricing_tier_indie',
  },
  {
    name: 'Developer Seat',
    price: '$299',
    period: '/developer/year',
    features: [
      'Commercial use',
      'Unlimited end users',
      'Dev / staging / production',
      'Apps owned by your org',
      'Best for: startups & growing teams',
    ],
    highlight: true,
    cta: 'Buy developer seat',
    ctaHref: '/contact?source=pricing_tier_developer_seat',
    ctaId: 'pricing_tier_developer_seat',
  },
  {
    name: 'App Deployment',
    price: '$1,499',
    period: '/app/year',
    features: [
      'Unlimited developers',
      '1 production app',
      'Unlimited end users',
      'Procurement-friendly',
      'Best for: agencies, CI/CD-heavy teams',
    ],
    highlight: false,
    cta: 'License an app',
    ctaHref: '/contact?source=pricing_tier_app_deployment',
    ctaId: 'pricing_tier_app_deployment',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: 'starting at $10k/year',
    features: [
      'Custom contract & SLA',
      'Procurement support',
      'Security review',
      'Multi-app licensing',
      'Priority + private support channel',
    ],
    highlight: false,
    cta: 'Contact sales',
    ctaHref: '/contact?source=pricing_tier_enterprise',
    ctaId: 'pricing_tier_enterprise',
  },
];

export function PricingGrid() {
  return (
    <Section surface="canvas">
      <Container>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 16,
            maxWidth: 1200,
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
                  fontSize: 40,
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
                  fontFamily: tokens.typography.body.family,
                  fontSize: 13,
                  color: tokens.colors.textMuted,
                  marginBottom: 16,
                  marginTop: 0,
                }}
              >
                {plan.period}
              </p>
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: '0 0 20px 0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  flex: 1,
                }}
              >
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    style={{
                      fontFamily: tokens.typography.body.family,
                      fontSize: 14,
                      lineHeight: 1.5,
                      color: tokens.colors.textSecondary,
                      paddingLeft: 16,
                      position: 'relative',
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        left: 0,
                        color: tokens.colors.accent,
                      }}
                    >
                      ✓
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                variant={plan.highlight ? 'primary' : 'ghost'}
                size="md"
                href={plan.ctaHref}
                {...(plan.ctaExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                onClick={() =>
                  trackCtaClick({
                    surface: 'pricing',
                    destination_url: plan.ctaHref,
                    cta_id: plan.ctaId,
                    cta_text: plan.cta,
                  })
                }
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
