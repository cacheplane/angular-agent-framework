import { PilotHero } from '../../components/landing/PilotHero';
import { WhatIsIncluded } from '../../components/landing/WhatIsIncluded';
import { HowItWorks } from '../../components/landing/HowItWorks';
import { ProblemSection } from '../../components/landing/ProblemSection';
import { PricingSignal } from '../../components/landing/PricingSignal';
import { RiskRemoval } from '../../components/landing/RiskRemoval';
import { WhitePaperGate } from '../../components/landing/WhitePaperGate';
import { PilotFooterCTA } from '../../components/landing/PilotFooterCTA';
import { tokens } from '../../../lib/design-tokens';

export const metadata = {
  title: 'Pilot to Production — Angular Agent Framework',
  description: 'Close the last-mile gap. Purchase an app deployment license and we work alongside your Angular team for 3 months to ship your first agent to production.',
};

export default function PilotToProdPage() {
  return (
    <>
      <div style={{ background: tokens.gradient.bgFlow, position: 'relative', overflow: 'hidden' }}>
        {/* Ambient gradient blobs */}
        <div
          style={{
            position: 'absolute',
            width: 600,
            height: 600,
            borderRadius: '50%',
            background: tokens.gradient.warm,
            top: -200,
            left: -150,
            filter: 'blur(80px)',
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        />
        <div
          style={{
            position: 'absolute',
            width: 500,
            height: 500,
            borderRadius: '50%',
            background: tokens.gradient.cool,
            top: 800,
            right: -100,
            filter: 'blur(80px)',
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        />
        <div
          style={{
            position: 'absolute',
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: tokens.gradient.warm,
            top: 2400,
            left: -100,
            filter: 'blur(80px)',
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        />
        <PilotHero />
        <WhatIsIncluded />
        <HowItWorks />
        <ProblemSection />
        <PricingSignal />
        <RiskRemoval />
        <WhitePaperGate />
      </div>
      <PilotFooterCTA />
    </>
  );
}
