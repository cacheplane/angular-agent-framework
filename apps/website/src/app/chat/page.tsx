import { tokens } from '@ngaf/design-tokens';
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

export const metadata = {
  title: '@ngaf/chat — Batteries-Included Agent Chat for Angular',
  description: 'Production agent chat UI in days, not sprints. Built on Vercel json-render and Google A2UI specs.',
};

export default async function ChatPage() {
  return (
    <>
      {/* Hero */}
      <Section surface="canvas" ariaLabelledBy="chat-hero-heading">
        <Container>
          <div style={{ maxWidth: 820, margin: '0 auto', textAlign: 'center' }}>
            <Eyebrow tone="accent" style={{ marginBottom: 16 }}>@ngaf/chat</Eyebrow>
            <h1
              id="chat-hero-heading"
              style={{
                fontFamily: tokens.typography.h1.family,
                fontSize: tokens.typography.h1.size,
                lineHeight: tokens.typography.h1.line,
                fontWeight: 700,
                color: tokens.colors.textPrimary,
                margin: 0,
                marginBottom: 24,
                letterSpacing: '-0.02em',
              }}
            >
              Drop-in chat for Angular agents.
            </h1>
            <p
              style={{
                fontFamily: tokens.typography.bodyLg.family,
                fontSize: tokens.typography.bodyLg.size,
                lineHeight: tokens.typography.bodyLg.line,
                color: tokens.colors.textSecondary,
                margin: '0 auto 32px',
                maxWidth: 640,
              }}
            >
              chat-timeline + chat-debug + GenUI surfaces. Production-shaped from day one, themable to your design system, or use the headless primitives if you want full control.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
              <Button variant="primary" size="lg" href="/docs/chat/getting-started/introduction">Get started</Button>
              <Button variant="ghost" size="lg" href="https://cockpit.cacheplane.ai" target="_blank" rel="noopener noreferrer">
                See it live →
              </Button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
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
        bullets={[
          'chat-timeline — drop-in production surface',
          'chat-debug — devtools alongside, ship-ready',
          'Sidenav + history search palette',
          'Themable via CSS vars or component overrides',
        ]}
        supportingCards={[
          { title: 'chat-timeline', description: 'The conversation surface.' },
          { title: 'chat-debug', description: 'Tool-call devtools.' },
          { title: 'sidenav', description: 'Thread navigation.' },
        ]}
        cta={{ label: 'See @ngaf/chat docs', href: '/docs/chat/getting-started/introduction' }}
        visual={
          <BrowserFrame url="cockpit.cacheplane.ai/chat-debug" elevation="md">
            <div style={{ padding: 24, minHeight: 320, background: 'linear-gradient(180deg, #fff, #f8fafc)' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <Pill variant="accent">streaming</Pill>
                <Pill variant="neutral">3 tools</Pill>
                <Pill variant="neutral">1 interrupt</Pill>
              </div>
              <div style={{ fontFamily: tokens.typography.fontMono, fontSize: 11, color: tokens.colors.textMuted, marginBottom: 8 }}>
                tool · query_inventory · 240ms
              </div>
              <div style={{
                background: tokens.surfaces.surfaceTinted,
                border: `1px solid ${tokens.surfaces.border}`,
                borderRadius: tokens.radius.md,
                padding: 12,
                fontFamily: tokens.typography.fontMono,
                fontSize: 12,
                color: tokens.colors.textPrimary,
              }}>
                {`{ items: 47, low_stock: 3, total_value: 12400 }`}
              </div>
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${tokens.surfaces.border}`, fontFamily: tokens.typography.fontMono, fontSize: 11, color: tokens.colors.textSecondary }}>
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
        bullets={[
          'Primitives stay unstyled',
          'Bring your own design tokens',
          'Compose with the streaming agent contract',
          'No two-way coupling to the chat shell',
        ]}
        supportingCards={[
          { title: 'message primitives', description: 'Streaming-aware atoms.' },
          { title: 'tool primitives', description: 'Tool-call lifecycle.' },
          { title: 'interrupt primitive', description: 'Approval gate.' },
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
