// apps/website/src/app/angular/page.tsx
import { AngularHero } from '../../components/landing/angular/AngularHero';
import { AngularProblemSolution } from '../../components/landing/angular/AngularProblemSolution';
import { AngularFeaturesGrid } from '../../components/landing/angular/AngularFeaturesGrid';
import { AngularCodeShowcase } from '../../components/landing/angular/AngularCodeShowcase';
import { AngularComparison } from '../../components/landing/angular/AngularComparison';
import { AngularWhitePaperGate } from '../../components/landing/angular/AngularWhitePaperGate';
import { AngularStackSiblings } from '../../components/landing/angular/AngularStackSiblings';
import { AngularFooterCTA } from '../../components/landing/angular/AngularFooterCTA';
import { tokens } from '@cacheplane/design-tokens';

export const metadata = {
  title: '@cacheplane/angular — Agent Streaming for Angular',
  description: 'Ship LangGraph agents in Angular. Signal-native streaming, thread persistence, interrupts, and deterministic testing.',
};

export default function AngularPage() {
  return (
    <div style={{ background: tokens.gradient.bgFlow, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,64,144,0.08) 0%, transparent 70%)', top: -200, left: -150, filter: 'blur(80px)', pointerEvents: 'none' }} aria-hidden="true" />
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: tokens.gradient.cool, top: 800, right: -100, filter: 'blur(80px)', pointerEvents: 'none' }} aria-hidden="true" />
      <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,64,144,0.06) 0%, transparent 70%)', top: 2400, left: -100, filter: 'blur(80px)', pointerEvents: 'none' }} aria-hidden="true" />
      <AngularHero />
      <AngularProblemSolution />
      <AngularFeaturesGrid />
      <AngularCodeShowcase />
      <AngularComparison />
      <AngularWhitePaperGate />
      <AngularStackSiblings />
      <AngularFooterCTA />
    </div>
  );
}
