import Script from 'next/script';
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

      {/* Angular Elements live demo */}
      <section className="px-8 py-16 max-w-3xl mx-auto" style={{ position: 'relative', zIndex: 1 }}>
        <p className="font-mono text-xs uppercase tracking-widest mb-8 text-center"
          style={{ color: tokens.colors.accent }}>Live Demo</p>
        <div className="rounded-xl overflow-hidden"
          style={{ border: `1px solid ${tokens.glass.border}`, boxShadow: tokens.glow.demo }}>
          {/* @ts-expect-error — custom element registered by Angular Elements bundle */}
          <stream-chat-demo
            api-url={process.env['NEXT_PUBLIC_LANGGRAPH_URL'] ?? 'http://localhost:2024'}
            assistant-id="chat_agent"
          />
        </div>
        <Script src="/demo/main.js" strategy="lazyOnload" />
      </section>
    </div>
  );
}
