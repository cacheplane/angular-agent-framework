import { Hero } from '../components/landing/Hero';
import { EcosystemStrip } from '../components/landing/EcosystemStrip';
import { Differentiator } from '../components/landing/Differentiator';
import { FeatureBlock } from '../components/landing/FeatureBlock';
import { BrowserFrame } from '../components/ui/BrowserFrame';
import { HITL_CLIP } from '../lib/demo-media';
import { DemoShowcase } from '../components/landing/DemoShowcase';
import { PilotBlock } from '../components/landing/PilotBlock';
import { WhitePaperBlock } from '../components/landing/WhitePaperBlock';
import { Promises } from '../components/landing/Promises';
import { HomeFAQ } from '../components/landing/HomeFAQ';
import { FinalCTA } from '../components/landing/FinalCTA';
import { RecentArticles } from '../components/landing/RecentArticles';
import { Section } from '../components/ui/Section';
import { Container } from '../components/ui/Container';
import { tokens } from '@threadplane/design-tokens';
import { createPageMetadata, LONG_SUBHEAD, PRIMARY_TAGLINE } from '../lib/site-metadata';

export const metadata = createPageMetadata({
  title: PRIMARY_TAGLINE,
  description: LONG_SUBHEAD,
  pathname: '/',
  type: 'website',
});

export default async function HomePage() {
  return (
    <>
      <Hero />
      <EcosystemStrip />
      <Differentiator />

      {/* Interactive demo showcase */}
      <Section surface="canvas">
        <Container>
          <DemoShowcase />
        </Container>
      </Section>

      {/* Stream */}
      <FeatureBlock
        id="stream"
        eyebrow="Stream"
        headline="Build the Angular UI layer for production agents."
        body={
          <>
            <code style={{ fontFamily: tokens.typography.fontMono }}>provideAgent</code> + <code style={{ fontFamily: tokens.typography.fontMono }}>injectAgent()</code> give you headless chat, durable threads, interrupts, tool progress, and generative UI. LangGraph and AG-UI adapters share the contract, so teams can swap runtimes without rewriting the Angular surface.
          </>
        }
        bullets={[
          'Headless chat and durable thread state',
          'Interrupts, tool progress, branch/history',
          'Adapters: LangGraph (@threadplane/langgraph), AG-UI (@threadplane/ag-ui)',
          'One Angular UI layer, swappable runtimes',
        ]}
        supportingCards={[
          { title: 'provideAgent', description: 'Wire the agent into Angular DI.' },
          { title: '@threadplane/ag-ui', description: 'Any AG-UI compliant backend.' },
          { title: '@threadplane/langgraph', description: 'Native LangGraph streaming.' },
        ]}
        cta={{ label: 'Read the streaming guide', href: '/docs/langgraph/guides/streaming' }}
        visual={
          <BrowserFrame url="cockpit.threadplane.ai/langgraph/core-capabilities/streaming/overview/python" elevation="md">
            <img
              src="/screenshots/cockpit-docs.webp"
              alt="Cockpit reference app — Angular streaming guide with provideAgent setup"
              style={{ display: 'block', width: '100%', height: 'auto' }}
              loading="lazy"
              decoding="async"
            />
          </BrowserFrame>
        }
      />

      {/* Render */}
      <FeatureBlock
        id="render"
        eyebrow="Render"
        headline="Generative UI that renders into your design system."
        body="Server-emitted JSON specs become Angular components you already own. Vercel json-render and Google A2UI both supported, with per-component fallback and a readiness gate."
        bullets={[
          'Per-component fallback API + readiness gate',
          'A2UI v1 + Vercel json-render adapter',
          'Renders into your existing component library',
          'Server-side schema, client-side trust',
        ]}
        supportingCards={[
          { title: 'chat-timeline', description: 'Drop-in conversation surface.' },
          { title: 'chat-debug', description: 'Live devtools for tool calls.' },
          { title: 'GenUI surfaces', description: 'Schema-driven UI from agent output.' },
        ]}
        cta={{ label: 'See @threadplane/render', href: '/render' }}
        visualLeft
        visual={
          <BrowserFrame url="cockpit.threadplane.ai" elevation="md">
            <img
              src="/screenshots/cockpit-api.webp"
              alt="Cockpit reference app — API reference rendered as structured cards"
              style={{ display: 'block', width: '100%', height: 'auto' }}
              loading="lazy"
              decoding="async"
            />
          </BrowserFrame>
        }
      />

      {/* Ship — the live demo */}
      <FeatureBlock
        id="ship"
        eyebrow="Ship"
        headline="Patterns built for production, not demos."
        body="Error boundaries, observability hooks, fallback strategies — the stuff that turns a demo into a real app. Most packages are MIT; the drop-in chat package is commercially licensed for production use."
        bullets={[
          'error() / status() / reload() signals',
          'Readiness gate + per-component fallback',
          'Thread persistence patterns',
          'Clear package licensing',
        ]}
        supportingCards={[
          { title: 'error/status/reload', description: 'Boundary signals for every agent.' },
          { title: 'readiness gate', description: 'Hold renders until the surface is real.' },
          { title: 'thread persistence', description: 'Restore conversations across sessions.' },
        ]}
        cta={{ label: 'Production patterns', href: '/docs/langgraph/guides/deployment' }}
        visual={
          <BrowserFrame url="demo.threadplane.ai" elevation="lg">
            <img
              src="/screenshots/canonical-demo-generative-ui.webp"
              alt="Threadplane chat rendering a live generative-UI dashboard"
              style={{ display: 'block', width: '100%', height: 'auto' }}
              loading="lazy"
              decoding="async"
            />
          </BrowserFrame>
        }
      />

      {/*
        The homepage claims human-in-the-loop in the Differentiator table and
        mentions interrupts in the Stream block, but nothing here showed it.
        This is the only section whose heading the approval clip actually
        illustrates — the same rule the solutions pages follow.
      */}
      <FeatureBlock
        id="approve"
        eyebrow="Approve"
        headline="Nothing irreversible happens without a human."
        body={
          <>
            <code style={{ fontFamily: tokens.typography.fontMono }}>interrupt()</code> freezes the graph
            mid-run and the pause lives in the checkpoint, not in component state. Your UI renders the
            proposal, the human answers, and{' '}
            <code style={{ fontFamily: tokens.typography.fontMono }}>submit({'{ resume }'})</code> continues
            the run — with the decision written back beside the action it gated.
          </>
        }
        bullets={[
          'interrupt() pauses mid-run; submit({ resume }) continues it',
          '<chat-interrupt-panel> renders the proposal',
          'The pause is a checkpoint, not a modal',
          'Decision and proposal land in one thread record',
        ]}
        supportingCards={[
          { title: 'interrupt()', description: 'Freezes the graph before the action runs.' },
          { title: 'resume', description: 'Carries the human decision back into the run.' },
          { title: 'checkpoint', description: 'The pause survives; it is not UI state.' },
        ]}
        cta={{ label: 'Interrupt patterns', href: '/docs/langgraph/guides/interrupts' }}
        visualLeft
        visual={
          <BrowserFrame url={HITL_CLIP.url} elevation="lg">
            <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 10', background: '#15161f' }}>
              <video
                autoPlay
                muted
                loop
                playsInline
                poster={HITL_CLIP.poster}
                aria-label={HITL_CLIP.caption}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              >
                <source src={HITL_CLIP.videoWebm} type="video/webm" />
                <source src={HITL_CLIP.videoMp4} type="video/mp4" />
              </video>
            </div>
          </BrowserFrame>
        }
      />

      <PilotBlock />
      <WhitePaperBlock />
      <Promises />
      <HomeFAQ />
      <FinalCTA />
      <RecentArticles />
    </>
  );
}
