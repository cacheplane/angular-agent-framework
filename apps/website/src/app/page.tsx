import { HeroTwoCol } from '../components/landing/HeroTwoCol';
import { ArchDiagram } from '../components/landing/ArchDiagram';
import { ValueProps } from '../components/landing/ValueProps';
import { LangGraphShowcase } from '../components/landing/LangGraphShowcase';
import { DeepAgentsShowcase } from '../components/landing/DeepAgentsShowcase';
import { StatsStrip } from '../components/landing/StatsStrip';
import { ProblemSection } from '../components/landing/ProblemSection';
import { FullStackSection } from '../components/landing/FullStackSection';
import { ChatFeaturesSection } from '../components/landing/ChatFeaturesSection';
import { FairComparisonSection } from '../components/landing/FairComparisonSection';
import { WhitePaperSection } from '../components/landing/WhitePaperSection';
import { HomePilotCTA } from '../components/landing/HomePilotCTA';
import { tokens } from '../../lib/design-tokens';

export default async function HomePage() {
  return (
    <div style={{ background: tokens.gradient.bgFlow, position: 'relative', overflow: 'hidden' }}>
      {/* Ambient gradient blobs */}
      <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: tokens.gradient.warm, top: -200, left: -150, filter: 'blur(80px)', pointerEvents: 'none' }} aria-hidden="true" />
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: tokens.gradient.cool, top: 800, right: -100, filter: 'blur(80px)', pointerEvents: 'none' }} aria-hidden="true" />
      <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: tokens.gradient.warm, top: 2000, left: -100, filter: 'blur(80px)', pointerEvents: 'none' }} aria-hidden="true" />
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: tokens.gradient.cool, top: 3500, right: -150, filter: 'blur(80px)', pointerEvents: 'none' }} aria-hidden="true" />
      <div style={{ position: 'absolute', width: 350, height: 350, borderRadius: '50%', background: tokens.gradient.coolLight, top: 5000, left: '30%', filter: 'blur(70px)', pointerEvents: 'none' }} aria-hidden="true" />
      <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: tokens.gradient.warm, top: 6500, right: -100, filter: 'blur(80px)', pointerEvents: 'none' }} aria-hidden="true" />
      <div style={{ position: 'absolute', width: 350, height: 350, borderRadius: '50%', background: tokens.gradient.cool, top: 8000, left: '20%', filter: 'blur(70px)', pointerEvents: 'none' }} aria-hidden="true" />

      {/* 1. Hook — headline, animation, CTA */}
      <HeroTwoCol />
      {/* 2. Trust — quick credibility stats */}
      <StatsStrip />
      {/* 3. Problem — last-mile gap narrative */}
      <ProblemSection />
      {/* 4. Architecture — three-layer stack diagram */}
      <FullStackSection />
      {/* 5. Chat features — interactive 4-tab scenarios */}
      <ChatFeaturesSection />
      {/* 6. Value — why this product, with interactive code tabs */}
      <ValueProps />
      {/* 7. Depth — capability showcases */}
      <LangGraphShowcase />
      <DeepAgentsShowcase />
      {/* 8. Fair comparison — honest LangChain + Angular Stream Resource table */}
      <FairComparisonSection />
      {/* 9. White paper free download */}
      <WhitePaperSection />
      {/* 10. Pilot program CTA */}
      <HomePilotCTA />
      {/* 11. Architecture — technical credibility */}
      <ArchDiagram />
    </div>
  );
}
