import { Hero } from '../components/landing/Hero';
import { LogoRibbon } from '../components/landing/LogoRibbon';
import { ProofStrip } from '../components/landing/ProofStrip';
import { FeatureBlock } from '../components/landing/FeatureBlock';
import { StackDiagramSection } from '../components/landing/StackDiagramSection';
import { HomeConceptGrid } from '../components/landing/HomeConceptGrid';
import { DemoShowcase } from '../components/landing/DemoShowcase';
import { MediumSwitcher } from '../components/landing/MediumSwitcher';
import { SECTION_MEDIA } from '../lib/section-media';
import { buildPanes } from '../lib/build-panes';
import { PilotBlock } from '../components/landing/PilotBlock';
import { WhitePaperBlock } from '../components/landing/WhitePaperBlock';
import { HomeFAQ } from '../components/landing/HomeFAQ';
import { FinalCTA } from '../components/landing/FinalCTA';
import { RecentArticles } from '../components/landing/RecentArticles';
import { Section } from '../components/ui/Section';
import { Container } from '../components/ui/Container';
import { createPageMetadata, LONG_SUBHEAD, PRIMARY_TAGLINE } from '../lib/site-metadata';
import { getFormPolicy } from '../lib/growth/form-policy';

export const metadata = createPageMetadata({
  title: PRIMARY_TAGLINE,
  description: LONG_SUBHEAD,
  pathname: '/',
  type: 'website',
});

export default async function HomePage() {
  const formPolicy = getFormPolicy();
  const [streamPanes, renderPanes, shipPanes, approvePanes] = await Promise.all(
    (['stream', 'render', 'ship', 'approve'] as const).map((key) =>
      buildPanes(SECTION_MEDIA[key], SECTION_MEDIA[key].video?.url ?? ''),
    ),
  );

  return (
    <>
      <Hero />
      <LogoRibbon />
      <ProofStrip />

      <StackDiagramSection
        id="architecture"
        eyebrow="Architecture"
        headline="Your UI talks to one contract, never to a runtime"
        body="Your Angular components consume a signal-shaped Agent contract. Adapters implement it — swap the runtime underneath without touching the UI."
      />

      <HomeConceptGrid />

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
        headline="One provider. A whole agent surface."
        body={
          <>
            <code className="home-code">provideAgent</code> wires the agent into DI;{' '}
            <code className="home-code">injectAgent()</code> hands back signals — messages(), status(), error() — plus durable threads and tool progress.
          </>
        }
        rows={[
          { claim: 'Signals, not promises', api: 'injectAgent()' },
          { claim: 'Threads that branch, resume, replay', api: 'threadId' },
          { claim: 'Same contract on LangGraph and AG-UI', api: 'runtime adapters' },
        ]}
        cta={{ label: 'Read the streaming guide', href: '/docs/langgraph/guides/streaming' }}
        visual={<MediumSwitcher sectionId="stream" panes={streamPanes} />}
      />

      {/* Render */}
      <FeatureBlock
        id="render"
        eyebrow="json-render"
        headline="Agent output, rendered as your components."
        body="The server emits a JSON spec. Angular renders it with components you own — json-render and A2UI both speak it."
        rows={[
          { claim: 'Your design system, not a chat widget', api: '@threadplane/render' },
          { claim: 'Unknown specs degrade per component', api: 'fallback + readiness gate' },
          { claim: 'Schema on the server, trust in the client', api: 'validated specs' },
        ]}
        cta={{ label: 'See @threadplane/render', href: '/render' }}
        visualLeft
        visual={<MediumSwitcher sectionId="render" panes={renderPanes} />}
      />

      {/* Ship — the live demo */}
      <FeatureBlock
        id="ship"
        eyebrow="Ship"
        headline="Demos stream. Production recovers."
        body="The seams that turn a demo into an app: error boundaries, readiness gates, and threads that outlive deploys."
        rows={[
          { claim: 'error() / status() / reload() on every agent', api: 'boundary signals' },
          { claim: 'Fallback content where specs go wrong', api: 'readiness gate' },
          { claim: 'Conversations restore across sessions', api: 'thread persistence' },
        ]}
        cta={{ label: 'Production patterns', href: '/docs/langgraph/guides/deployment' }}
        visual={<MediumSwitcher sectionId="ship" panes={shipPanes} />}
      />

      {/*
        This is the only section whose heading the approval clip actually
        illustrates — the same rule the solutions pages follow.
      */}
      <FeatureBlock
        id="approve"
        eyebrow="Approve"
        headline="Nothing irreversible without a human."
        body={
          <>
            <code className="home-code">interrupt()</code> freezes the run inside the checkpoint. Your UI renders the proposal;{' '}
            <code className="home-code">submit({'{ resume }'})</code> continues with the decision on the record.
          </>
        }
        rows={[
          { claim: 'The pause is a checkpoint, not a modal', api: 'interrupt()' },
          { claim: 'The proposal renders in your UI', api: '<chat-interrupt-panel>' },
          { claim: 'The decision lands beside the action it gated', api: 'submit({ resume })' },
        ]}
        cta={{ label: 'Interrupt patterns', href: '/docs/langgraph/guides/interrupts' }}
        visualLeft
        visual={<MediumSwitcher sectionId="approve" panes={approvePanes} />}
      />

      <PilotBlock />
      <WhitePaperBlock formPolicy={formPolicy} />
      <HomeFAQ />
      <RecentArticles />
      <FinalCTA variant="dark" />
    </>
  );
}
