import { HeroTwoCol } from '../components/landing/HeroTwoCol';
import { ArchDiagram } from '../components/landing/ArchDiagram';
import { ValueProps } from '../components/landing/ValueProps';
import { LangGraphShowcase } from '../components/landing/LangGraphShowcase';
import { DeepAgentsShowcase } from '../components/landing/DeepAgentsShowcase';
import { FeatureStrip } from '../components/landing/FeatureStrip';
import { CodeBlock } from '../components/landing/CodeBlock';
import { CockpitCTA } from '../components/landing/CockpitCTA';
import { StatsStrip } from '../components/landing/StatsStrip';
import { ProblemSection } from '../components/landing/ProblemSection';
import { FullStackSection } from '../components/landing/FullStackSection';
import { ChatFeaturesSection } from '../components/landing/ChatFeaturesSection';
import { FairComparisonSection } from '../components/landing/FairComparisonSection';
import { tokens } from '../../lib/design-tokens';

export default async function HomePage() {
  return (
    <div style={{ background: tokens.gradient.bgFlow, position: 'relative', overflow: 'hidden' }}>
      {/* Ambient gradient blobs distributed across the long page */}
      <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: tokens.gradient.warm, top: -200, left: -150, filter: 'blur(80px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: tokens.gradient.cool, top: 800, right: -100, filter: 'blur(80px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: tokens.gradient.warm, top: 2000, left: -100, filter: 'blur(80px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: tokens.gradient.cool, top: 3500, right: -150, filter: 'blur(80px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 350, height: 350, borderRadius: '50%', background: tokens.gradient.coolLight, top: 5000, left: '30%', filter: 'blur(70px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: tokens.gradient.warm, top: 6500, right: -100, filter: 'blur(80px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 350, height: 350, borderRadius: '50%', background: tokens.gradient.cool, top: 8000, left: '20%', filter: 'blur(70px)', pointerEvents: 'none' }} />

      {/* 1. Hook */}
      <HeroTwoCol />
      {/* 2. Trust */}
      <StatsStrip />
      {/* 3. Problem */}
      <ProblemSection />
      {/* 4. Architecture */}
      <FullStackSection />
      {/* 5. Chat features */}
      <ChatFeaturesSection />
      {/* 6. Value */}
      <ValueProps />
      {/* 7. Proof */}
      <CodeBlock />
      {/* 8. Depth */}
      <LangGraphShowcase />
      <DeepAgentsShowcase />
      {/* 9. Fair comparison */}
      <FairComparisonSection />
      {/* 10. Architecture */}
      <ArchDiagram />
      {/* 11. Features */}
      <FeatureStrip />
      {/* 12. Convert */}
      <CockpitCTA />
    </div>
  );
}
