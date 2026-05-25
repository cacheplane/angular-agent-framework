import { Hero } from '../components/landing/Hero';
import { EcosystemStrip } from '../components/landing/EcosystemStrip';
import { Differentiator } from '../components/landing/Differentiator';
import { FeatureBlock } from '../components/landing/FeatureBlock';
import { BrowserFrame } from '../components/ui/BrowserFrame';
import { LiveDemoFrame } from '../components/landing/LiveDemoFrame';
import { PilotBlock } from '../components/landing/PilotBlock';
import { WhitePaperBlock } from '../components/landing/WhitePaperBlock';
import { Promises } from '../components/landing/Promises';
import { HomeFAQ } from '../components/landing/HomeFAQ';
import { FinalCTA } from '../components/landing/FinalCTA';
import { RecentArticles } from '../components/landing/RecentArticles';
import { tokens } from '@ngaf/design-tokens';
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

      {/* Stream */}
      <FeatureBlock
        id="stream"
        eyebrow="Stream"
        headline="Build the Angular UI layer for production agents."
        body={
          <>
            <code style={{ fontFamily: tokens.typography.fontMono }}>provideAgent</code> + <code style={{ fontFamily: tokens.typography.fontMono }}>agent()</code> give you headless chat, durable threads, interrupts, tool progress, and generative UI. LangGraph and AG-UI adapters share the contract, so teams can swap runtimes without rewriting the Angular surface.
          </>
        }
        bullets={[
          'Headless chat and durable thread state',
          'Interrupts, tool progress, branch/history',
          'Adapters: LangGraph (@ngaf/langgraph), AG-UI (@ngaf/ag-ui)',
          'One Angular UI layer, swappable runtimes',
        ]}
        supportingCards={[
          { title: 'provideAgent', description: 'Wire the agent into your app.config.ts.' },
          { title: 'AgUiAdapter', description: 'Any AG-UI compliant backend.' },
          { title: 'LangGraphAdapter', description: 'Native LangGraph streaming.' },
        ]}
        cta={{ label: 'Read the streaming guide', href: '/docs/agent/api/agent' }}
        visual={
          <BrowserFrame url="cockpit.threadplane.ai/langgraph/streaming" elevation="md">
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
          'A2UI v0.9-compatible protocol + Vercel json-render adapter',
          'Renders into your existing component library',
          'Server-side schema, client-side trust',
        ]}
        supportingCards={[
          { title: 'chat-timeline', description: 'Drop-in conversation surface.' },
          { title: 'chat-debug', description: 'Live devtools for tool calls.' },
          { title: 'GenUI surfaces', description: 'Schema-driven UI from agent output.' },
        ]}
        cta={{ label: 'See @ngaf/render', href: '/render' }}
        visualLeft
        visual={
          <BrowserFrame url="cockpit.threadplane.ai/langgraph/api" elevation="md">
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
        body="Error boundaries, observability hooks, fallback strategies — the stuff that turns a demo into a real app. MIT-licensed, so the code is yours forever."
        bullets={[
          'error() / status() / reload() signals',
          'Readiness gate + per-component fallback',
          'Thread persistence patterns',
          'MIT licensed — own it forever',
        ]}
        supportingCards={[
          { title: 'error/status/reload', description: 'Boundary signals for every agent.' },
          { title: 'readiness gate', description: 'Hold renders until the surface is real.' },
          { title: 'thread persistence', description: 'Restore conversations across sessions.' },
        ]}
        cta={{ label: 'Production patterns', href: '/docs/agent/guides/deployment' }}
        visual={<LiveDemoFrame />}
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
