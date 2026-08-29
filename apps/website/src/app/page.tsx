import { Hero } from '../components/landing/Hero';
import { EcosystemStrip } from '../components/landing/EcosystemStrip';
import { Differentiator } from '../components/landing/Differentiator';
import { FeatureBlock } from '../components/landing/FeatureBlock';
import { BrowserFrame } from '../components/ui/BrowserFrame';
import { ClipPlayer } from '../components/ui/ClipPlayer';
import { DemoShowcase } from '../components/landing/DemoShowcase';
import { MediumSwitcher } from '../components/landing/MediumSwitcher';
import type { MediumPane } from '../components/landing/MediumSwitcher';
import { HighlightedCode } from '../components/landing/HighlightedCode';
import { SECTION_MEDIA } from '../lib/section-media';
import type { SectionMedia } from '../lib/section-media';
import { PilotBlock } from '../components/landing/PilotBlock';
import { WhitePaperBlock } from '../components/landing/WhitePaperBlock';
import { Promises } from '../components/landing/Promises';
import { HomeFAQ } from '../components/landing/HomeFAQ';
import { FinalCTA } from '../components/landing/FinalCTA';
import { RecentArticles } from '../components/landing/RecentArticles';
import { Section } from '../components/ui/Section';
import { Container } from '../components/ui/Container';
import { createPageMetadata, LONG_SUBHEAD, PRIMARY_TAGLINE } from '../lib/site-metadata';

export const metadata = createPageMetadata({
  title: PRIMARY_TAGLINE,
  description: LONG_SUBHEAD,
  pathname: '/',
  type: 'website',
});

/**
 * Builds the panes for a section on the SERVER.
 *
 * `HighlightedCode` is an async Server Component, so it cannot be rendered from
 * inside the client `MediumSwitcher`. Highlighting here and passing the result
 * as a prop is what makes the code tab possible at all.
 */
async function buildPanes(media: SectionMedia, clipUrl: string): Promise<MediumPane[]> {
  // Typed, not inferred: `const panes = []` is `any[]` under this tsconfig and
  // fails the production build's type check.
  const panes: MediumPane[] = [];

  if (media.video) {
    const clip = media.video;
    panes.push({
      id: 'video',
      key: 'video',
      label: 'Video',
      content: <ClipPlayer clip={clip} url={clipUrl} />,
    });
  }

  const codeBlocks = media.code ?? [];
  codeBlocks.forEach((block, index) => {
    panes.push({
      id: `code-${index}`,
      key: 'code',
      label: codeBlocks.length > 1 ? block.label : 'Code',
      content: (
        <div className="home-code-frame">
          <HighlightedCode code={block.source} lang={block.language} />
        </div>
      ),
    });
  });

  if (media.live) {
    const mode = media.live.mode ?? 'embed';
    panes.push({
      id: 'live',
      key: 'live',
      label: 'Live',
      content: (
        <BrowserFrame url={clipUrl} elevation="lg">
          <div className="home-live-frame">
            {/*
              Mounted only when its tab is selected — `MediumSwitcher` renders
              one pane at a time, so this iframe is never requested on page load.
              `?featured=` opens the demo on this section's own scenario; the id
              is a key into the demo's curated list, so an unknown one falls back
              rather than rendering anything this URL supplies.
            */}
            <iframe
              src={`https://demo.threadplane.ai/${mode}?featured=${encodeURIComponent(media.live.featured)}`}
              title="Threadplane live demo"
              loading="lazy"
              className="home-live-iframe"
            />
          </div>
        </BrowserFrame>
      ),
    });
  }

  return panes;
}

export default async function HomePage() {
  const [streamPanes, renderPanes, shipPanes, approvePanes] = await Promise.all(
    (['stream', 'render', 'ship', 'approve'] as const).map((key) =>
      buildPanes(SECTION_MEDIA[key], SECTION_MEDIA[key].video?.url ?? ''),
    ),
  );

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
            <code className="home-code">provideAgent</code> + <code className="home-code">injectAgent()</code> give you headless chat, durable threads, interrupts, tool progress, and generative UI. LangGraph and AG-UI adapters share the contract, so teams can swap runtimes without rewriting the Angular surface.
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
        visual={<MediumSwitcher sectionId="stream" panes={streamPanes} />}
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
        visual={<MediumSwitcher sectionId="render" panes={renderPanes} />}
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
        visual={<MediumSwitcher sectionId="ship" panes={shipPanes} />}
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
            <code className="home-code">interrupt()</code> freezes the graph
            mid-run and the pause lives in the checkpoint, not in component state. Your UI renders the
            proposal, the human answers, and{' '}
            <code className="home-code">submit({'{ resume }'})</code> continues
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
        visual={<MediumSwitcher sectionId="approve" panes={approvePanes} />}
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
