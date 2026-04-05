import { HeroTwoCol } from '../components/landing/HeroTwoCol';
import { ArchDiagram } from '../components/landing/ArchDiagram';
import { ValueProps } from '../components/landing/ValueProps';
import { LangGraphShowcase } from '../components/landing/LangGraphShowcase';
import { DeepAgentsShowcase } from '../components/landing/DeepAgentsShowcase';
import { FeatureStrip } from '../components/landing/FeatureStrip';
import { CodeBlock } from '../components/landing/CodeBlock';
import { CockpitCTA } from '../components/landing/CockpitCTA';
import { StatsStrip } from '../components/landing/StatsStrip';
import { tokens } from '@cacheplane/design-tokens';

export default async function HomePage() {
  return (
    <div style={{ background: tokens.gradient.bgFlow, position: 'relative', overflow: 'hidden' }}>
      {/* Ambient gradient blobs distributed across the long page */}
      <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: tokens.gradient.warm, top: -200, left: -150, filter: 'blur(80px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: tokens.gradient.cool, top: 800, right: -100, filter: 'blur(80px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: tokens.gradient.warm, top: 2000, left: -100, filter: 'blur(80px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: tokens.gradient.cool, top: 3500, right: -150, filter: 'blur(80px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 350, height: 350, borderRadius: '50%', background: tokens.gradient.coolLight, top: 5000, left: '30%', filter: 'blur(70px)', pointerEvents: 'none' }} />

      {/* 1. Hook — headline, animation, CTA */}
      <HeroTwoCol />
      {/* 2. Trust — quick credibility stats */}
      <StatsStrip />
      {/* 3. Value — why this product, with interactive code tabs */}
      <ValueProps />
      {/* 4. Proof — 30-second code example (show, don't tell) */}
      <CodeBlock />
      {/* 5. Depth — capability showcases with expandable code */}
      <LangGraphShowcase />
      <DeepAgentsShowcase />
      {/* 6. Architecture — technical credibility for evaluators */}
      <ArchDiagram />
      {/* 7. Features — compact summary grid */}
      <FeatureStrip />
      {/* 8. Convert — cockpit CTA */}
      <CockpitCTA />
    </div>
  );
}
