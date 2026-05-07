import { HeroTwoCol } from '../components/landing/HeroTwoCol';
import { PositioningStrip } from '../components/landing/PositioningStrip';
import { ProblemSection } from '../components/landing/ProblemSection';
import { PilotSolution } from '../components/landing/PilotSolution';
import { TheStack } from '../components/landing/TheStack';
import { WhitePaperSection } from '../components/landing/WhitePaperSection';
import { PilotFooterCTA } from '../components/landing/PilotFooterCTA';
import { tokens } from '../../lib/design-tokens';

export default async function HomePage() {
  return (
    <div style={{ background: tokens.gradient.bgFlow, position: 'relative', overflow: 'hidden' }}>
      {/* Ambient gradient blobs */}
      <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: tokens.gradient.warm, top: -200, left: -150, filter: 'blur(80px)', pointerEvents: 'none' }} aria-hidden="true" />
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: tokens.gradient.cool, top: 800, right: -100, filter: 'blur(80px)', pointerEvents: 'none' }} aria-hidden="true" />
      <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: tokens.gradient.warm, top: 2200, left: -100, filter: 'blur(80px)', pointerEvents: 'none' }} aria-hidden="true" />
      <div style={{ position: 'absolute', width: 350, height: 350, borderRadius: '50%', background: tokens.gradient.coolLight, top: 3800, right: '20%', filter: 'blur(70px)', pointerEvents: 'none' }} aria-hidden="true" />

      {/* 1. Hook — headline, animation, CTA */}
      <HeroTwoCol />
      {/* 2. Differentiation — positioning vs other agent UIs */}
      <PositioningStrip />
      {/* 3. Problem — last-mile gap narrative */}
      <ProblemSection />
      {/* 4. Solution — pilot-to-prod program */}
      <PilotSolution />
      {/* 5. Product — the three-library stack */}
      <TheStack />
      {/* 6. Lead gen — whitepaper download */}
      <WhitePaperSection />
      {/* 7. Final CTA — "Ready to stop stalling?" */}
      <PilotFooterCTA />
    </div>
  );
}
