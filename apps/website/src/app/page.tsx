import { HeroTwoCol } from '../components/landing/HeroTwoCol';
import { ArchDiagram } from '../components/landing/ArchDiagram';
import { FeatureStrip } from '../components/landing/FeatureStrip';
import { CodeBlock } from '../components/landing/CodeBlock';
import { tokens } from '../../lib/design-tokens';

export default async function HomePage() {
  return (
    <div style={{ background: tokens.gradient.bgFlow, position: 'relative', overflow: 'hidden' }}>
      {/* Ambient gradient blobs that extend beyond the hero */}
      <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: tokens.gradient.warm, top: -200, left: -150, filter: 'blur(80px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: tokens.gradient.cool, bottom: 200, right: -100, filter: 'blur(80px)', pointerEvents: 'none' }} />

      <HeroTwoCol />
      <ArchDiagram />
      <FeatureStrip />
      <CodeBlock />
    </div>
  );
}
