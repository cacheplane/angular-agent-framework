// apps/website/src/app/render/page.tsx
import { RenderHero } from '../../components/landing/render/RenderHero';
import { RenderProblemSolution } from '../../components/landing/render/RenderProblemSolution';
import { RenderFeaturesGrid } from '../../components/landing/render/RenderFeaturesGrid';
import { RenderCodeShowcase } from '../../components/landing/render/RenderCodeShowcase';
import { RenderComparison } from '../../components/landing/render/RenderComparison';
import { RenderWhitePaperGate } from '../../components/landing/render/RenderWhitePaperGate';
import { RenderStackSiblings } from '../../components/landing/render/RenderStackSiblings';
import { RenderFooterCTA } from '../../components/landing/render/RenderFooterCTA';
import { tokens } from '@ngaf/design-tokens';

export const metadata = {
  title: '@ngaf/render — Generative UI for Angular',
  description: 'Agents that render UI without coupling to your frontend. Built on Vercel json-render spec.',
};

export default function RenderPage() {
  return (
    <div style={{ background: tokens.gradient.bgFlow, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(26,122,64,0.08) 0%, transparent 70%)', top: -200, left: -150, filter: 'blur(80px)', pointerEvents: 'none' }} aria-hidden="true" />
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: tokens.gradient.cool, top: 800, right: -100, filter: 'blur(80px)', pointerEvents: 'none' }} aria-hidden="true" />
      <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(26,122,64,0.06) 0%, transparent 70%)', top: 2400, left: -100, filter: 'blur(80px)', pointerEvents: 'none' }} aria-hidden="true" />
      <RenderHero />
      <RenderProblemSolution />
      <RenderFeaturesGrid />
      <RenderCodeShowcase />
      <RenderComparison />
      <RenderWhitePaperGate />
      <RenderStackSiblings />
      <RenderFooterCTA />
    </div>
  );
}
