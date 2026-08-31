import { Container } from '../../components/ui/Container';
import { Section } from '../../components/ui/Section';
import { Eyebrow } from '../../components/ui/Eyebrow';
import { Button } from '../../components/ui/Button';
import { Pill } from '../../components/ui/Pill';
import { BrowserFrame } from '../../components/ui/BrowserFrame';
import { FeatureBlock } from '../../components/landing/FeatureBlock';
import { WhitePaperBlock } from '../../components/landing/WhitePaperBlock';
import { FinalCTA } from '../../components/landing/FinalCTA';
import { ChatLandingCodeShowcase } from '../../components/landing/chat-landing/ChatLandingCodeShowcase';
import { createPageMetadata } from '../../lib/site-metadata';

export const metadata = createPageMetadata({
  title: '@threadplane/chat — Batteries-Included Agent Chat for Angular',
  description: 'Production agent chat UI in days, not sprints. Built on Vercel json-render and Google A2UI specs.',
  pathname: '/chat',
  type: 'website',
});

export default async function ChatPage() {
  return (
    <>
      {/* Hero */}
      <Section surface="canvas" ariaLabelledBy="chat-hero-heading">
        <Container>
          <div className="chat-page-hero-inner">
            <Eyebrow tone="accent" className="chat-page-eyebrow-spaced">@threadplane/chat</Eyebrow>
            <h1 id="chat-hero-heading" className="chat-page-h1">
              Drop-in chat for Angular agents.
            </h1>
            <p className="chat-page-hero-subtitle">
              chat-timeline + chat-debug + GenUI surfaces. Production-shaped from day one, themable to your design system, or use the headless primitives if you want full control.
            </p>
            <div className="chat-page-hero-buttons">
              <Button variant="primary" size="lg" href="/docs/chat/getting-started/introduction">Get started</Button>
              <Button variant="ghost" size="lg" href="https://cockpit.threadplane.ai" target="_blank" rel="noopener noreferrer">
                See it live →
              </Button>
            </div>
            <div className="chat-page-hero-pills">
              <Pill variant="accent">MIT</Pill>
              <Pill variant="neutral">Vercel json-render</Pill>
              <Pill variant="neutral">Google A2UI</Pill>
            </div>
          </div>
        </Container>
      </Section>

      <FeatureBlock
        id="compositions"
        eyebrow="Compositions"
        headline="Opinionated shells, swappable parts."
        body="chat-timeline is a drop-in conversation surface that handles streaming, tool calls, interrupts, branching, and time-travel. chat-debug ships devtools alongside — tool-call inspector, message replay, thread history."
        rows={[
          { claim: 'A drop-in production conversation surface', api: 'chat-timeline' },
          { claim: 'Devtools beside it, ship-ready', api: 'chat-debug' },
          { claim: 'Thread navigation and history search', api: 'sidenav + palette' },
        ]}
        cta={{ label: 'See @threadplane/chat docs', href: '/docs/chat/getting-started/introduction' }}
        visual={
          <BrowserFrame url="cockpit.threadplane.ai/chat/core-capabilities/debug/overview/python" elevation="md">
            <div className="chat-page-visual-panel">
              <div className="chat-page-visual-pills-row">
                <Pill variant="accent">streaming</Pill>
                <Pill variant="neutral">3 tools</Pill>
                <Pill variant="neutral">1 interrupt</Pill>
              </div>
              <div className="chat-page-tool-label">
                tool · query_inventory · 240ms
              </div>
              <div className="chat-page-result-block">
                {`{ items: 47, low_stock: 3, total_value: 12400 }`}
              </div>
              <div className="chat-page-replay-footer">
                replay · 0:24 · paused on interrupt
              </div>
            </div>
          </BrowserFrame>
        }
      />

      <FeatureBlock
        id="headless"
        eyebrow="Headless"
        headline="Or skip the shell — use the primitives."
        body="If you have a design system, use the headless primitives directly. They're the same building blocks the compositions are made of — bring your own DOM, keep our state machine."
        rows={[
          { claim: 'Unstyled primitives, your design tokens', api: 'message + tool primitives' },
          { claim: 'The approval gate as a component', api: 'interrupt primitive' },
          { claim: 'Composes against the streaming contract', api: 'Agent contract' },
        ]}
        cta={{ label: 'Headless API', href: '/docs/chat/api/provide-chat' }}
        visualLeft
        visual={<ChatLandingCodeShowcase />}
      />

      <WhitePaperBlock paper="chat" />
      <FinalCTA />
    </>
  );
}
