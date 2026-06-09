'use client';
import { Button } from '../ui/Button';
import { DEMOS, demoCtaSuffix } from '../../lib/demos';
import { trackExternalLinkClick } from '../../lib/analytics/client';
import type { AnalyticsSurface, CtaId } from '../../lib/analytics/events';

interface Props {
  /** Analytics surface prefix, e.g. 'final_cta', 'home_demo'. */
  surface: string;
  size?: 'md' | 'lg';
}

/** Renders the LangGraph + AG-UI demos as two parallel CTA buttons. */
export function DemoCtaPair({ surface, size = 'lg' }: Props) {
  return (
    <>
      {DEMOS.map((demo, i) => (
        <Button
          key={demo.key}
          variant={i === 0 ? 'primary' : 'secondary'}
          size={size}
          href={demo.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() =>
            trackExternalLinkClick(demo.href, {
              surface: surface as AnalyticsSurface,
              cta_id: `${surface}_demo_${demoCtaSuffix(demo.key)}` as CtaId,
              cta_text: demo.label,
            })
          }
        >
          {demo.label} →
        </Button>
      ))}
    </>
  );
}
