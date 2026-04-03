'use client';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const PLANS = [
  {
    name: 'Community',
    price: 'Free',
    period: 'noncommercial use',
    features: ['PolyForm Noncommercial 1.0.0', 'Personal projects', 'Academic & research', 'Non-profit internal use'],
    highlight: false,
    cta: 'Get Started',
    ctaHref: 'https://www.npmjs.com/package/@cacheplane/stream-resource',
  },
  {
    name: 'Developer Seat',
    price: '$500',
    period: '/seat/year',
    features: ['Commercial use', '12-month release lock', 'Email support', 'All features'],
    highlight: false,
    cta: 'Buy License',
    ctaHref: '#lead-form',
  },
  {
    name: 'App Deployment',
    price: '$2,000',
    period: '/app one-time',
    features: ['Per-application license', 'All environments covered', 'No seat limits', 'Perpetual for version'],
    highlight: false,
    cta: 'Buy License',
    ctaHref: '#lead-form',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: 'volume licensing',
    features: ['Volume licensing', 'Priority support', 'Custom contract'],
    highlight: true,
    cta: 'Contact Us',
    ctaHref: '#lead-form',
  },
];

export function PricingGrid() {
  return (
    <section className="px-8 py-16 max-w-6xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {PLANS.map((plan) => (
          <Card
            key={plan.name}
            className="flex flex-col"
            style={{
              border: `1px solid ${plan.highlight ? '#6C8EFF' : 'rgba(108,142,255,0.15)'}`,
              boxShadow: plan.highlight ? '0 0 28px rgba(108,142,255,0.32)' : 'none',
            }}
          >
            <CardHeader className="pb-0">
              <Badge variant="default" className="w-fit mb-4">{plan.name}</Badge>
              <p
                style={{
                  fontFamily: 'var(--font-garamond)',
                  fontWeight: 700,
                  fontSize: 48,
                  color: '#EEF1FF',
                  lineHeight: 1,
                  marginBottom: 4,
                }}
              >
                {plan.price}
              </p>
              <p className="text-sm" style={{ color: '#4A527A' }}>{plan.period}</p>
            </CardHeader>
            <CardContent className="flex-1 pt-6">
              <ul className="flex flex-col gap-2">
                {plan.features.map((f) => (
                  <li key={f} className="text-sm flex items-center gap-2 text-muted-foreground">
                    <span style={{ color: '#6C8EFF' }}>✓</span> {f}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                asChild
                variant={plan.highlight ? 'default' : 'outline'}
                className="w-full"
              >
                <a href={plan.ctaHref}>{plan.cta}</a>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </section>
  );
}
