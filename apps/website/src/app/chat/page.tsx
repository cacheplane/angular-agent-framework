// apps/website/src/app/chat/page.tsx
import { ChatLandingHero } from '../../components/landing/chat-landing/ChatLandingHero';
import { ChatLandingProblemSolution } from '../../components/landing/chat-landing/ChatLandingProblemSolution';
import { ChatLandingFeaturesGrid } from '../../components/landing/chat-landing/ChatLandingFeaturesGrid';
import { ChatLandingCodeShowcase } from '../../components/landing/chat-landing/ChatLandingCodeShowcase';
import { ChatLandingComparison } from '../../components/landing/chat-landing/ChatLandingComparison';
import { ChatLandingWhitePaperGate } from '../../components/landing/chat-landing/ChatLandingWhitePaperGate';
import { ChatLandingStackSiblings } from '../../components/landing/chat-landing/ChatLandingStackSiblings';
import { ChatLandingFooterCTA } from '../../components/landing/chat-landing/ChatLandingFooterCTA';
import { tokens } from '@cacheplane/design-tokens';

export const metadata = {
  title: '@cacheplane/chat — Batteries-Included Agent Chat for Angular',
  description: 'Production agent chat UI in days, not sprints. Built on Vercel json-render and Google A2UI specs.',
};

export default function ChatPage() {
  return (
    <div style={{ background: tokens.gradient.bgFlow, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(90,0,200,0.08) 0%, transparent 70%)', top: -200, left: -150, filter: 'blur(80px)', pointerEvents: 'none' }} aria-hidden="true" />
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: tokens.gradient.cool, top: 800, right: -100, filter: 'blur(80px)', pointerEvents: 'none' }} aria-hidden="true" />
      <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(90,0,200,0.06) 0%, transparent 70%)', top: 2400, left: -100, filter: 'blur(80px)', pointerEvents: 'none' }} aria-hidden="true" />
      <ChatLandingHero />
      <ChatLandingProblemSolution />
      <ChatLandingFeaturesGrid />
      <ChatLandingCodeShowcase />
      <ChatLandingComparison />
      <ChatLandingWhitePaperGate />
      <ChatLandingStackSiblings />
      <ChatLandingFooterCTA />
    </div>
  );
}
