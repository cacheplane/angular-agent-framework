import { Hero } from '../components/landing/Hero';
import { LogoRibbon } from '../components/landing/LogoRibbon';
import { ProofStrip } from '../components/landing/ProofStrip';
import { RuntimeParity } from '../components/landing/RuntimeParity';
import { ThreeSteps } from '../components/landing/ThreeSteps';
import { FeatureBlock } from '../components/landing/FeatureBlock';
import { DemoShowcase } from '../components/landing/DemoShowcase';
import { MediumSwitcher } from '../components/landing/MediumSwitcher';
import { CodingAgentQuickstart } from '../components/landing/CodingAgentQuickstart';
import { ScopeTable } from '../components/landing/ScopeTable';
import { SECTION_MEDIA } from '../lib/section-media';
import { buildPanes } from '../lib/build-panes';
import { PilotBlock } from '../components/landing/PilotBlock';
import { WhitePaperBlock } from '../components/landing/WhitePaperBlock';
import { HomeFAQ } from '../components/landing/HomeFAQ';
import { FinalCTA } from '../components/landing/FinalCTA';
import { RecentArticles } from '../components/landing/RecentArticles';
import { Section } from '../components/ui/Section';
import { Container } from '../components/ui/Container';
import {
  createPageMetadata,
  HERO_SECONDARY_HREF,
  HOME_DESCRIPTION,
  HOME_TITLE,
  INSTALL_OPTIONS,
} from '../lib/site-metadata';
import { getFormPolicy } from '../lib/growth/form-policy';

export const metadata = createPageMetadata({
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  pathname: '/',
  type: 'website',
});

export default async function HomePage() {
  const formPolicy = getFormPolicy();
  const [streamPanes, persistPanes, approvePanes, renderPanes, testPanes] = await Promise.all(
    (['stream', 'persist', 'approve', 'render', 'test'] as const).map((key) =>
      buildPanes(SECTION_MEDIA[key], SECTION_MEDIA[key].video?.url ?? ''),
    ),
  );

  return (
    <>
      <Hero />
      <LogoRibbon />
      <ProofStrip />
      <RuntimeParity />
      <ThreeSteps />

      {/* Stream */}
      <FeatureBlock
        id="stream"
        eyebrow="Stream"
        headline="The UI stays reactive through tokens, tools, errors, and state changes."
        body={
          <>
            <code className="home-code">injectAgent()</code> hands back signals: messages(), status(), error(),
            isLoading(), and tool progress. Nothing to subscribe to, nothing to tear down.
          </>
        }
        rows={[
          { claim: 'Signals, not promises', api: 'injectAgent()' },
          { claim: 'Tool progress as it happens', api: 'toolProgress()' },
          { claim: 'Same contract on LangGraph and AG-UI', api: 'Agent' },
        ]}
        cta={{ label: 'Read the streaming guide', href: '/docs/langgraph/guides/streaming' }}
        visual={<MediumSwitcher sectionId="stream" panes={streamPanes} />}
      />

      {/* Persist */}
      <FeatureBlock
        id="persist"
        eyebrow="Persist"
        headline="A user can leave, return, inspect history, and continue."
        body="Thread selection, history, branch and replay UI in the Angular app. Durability itself comes from the runtime and persistence layer you connect — Threadplane exposes it, it does not fake it."
        rows={[
          { claim: 'Conversations restore across sessions', api: 'threadId + checkpoints' },
          { claim: 'Branch or replay from any point', api: 'branch / replay' },
          { claim: 'error() / status() / reload() on every agent', api: 'boundary signals' },
        ]}
        cta={{ label: 'Persistence patterns', href: '/docs/langgraph/guides/persistence' }}
        visualLeft
        visual={<MediumSwitcher sectionId="persist" panes={persistPanes} />}
      />

      {/* Approve */}
      <FeatureBlock
        id="approve"
        eyebrow="Approve"
        headline="Irreversible work pauses for a human decision."
        body={
          <>
            <code className="home-code">interrupt()</code> freezes the run inside the checkpoint. Your UI renders the
            proposal; <code className="home-code">submit({'{ resume }'})</code> continues with the decision on the
            record.
          </>
        }
        rows={[
          { claim: 'The pause is a checkpoint, not a modal', api: 'interrupt()' },
          { claim: 'The proposal renders in your UI', api: '<chat-interrupt-panel>' },
          { claim: 'The decision lands beside the action it gated', api: 'submit({ resume })' },
        ]}
        cta={{ label: 'Interrupt patterns', href: '/docs/langgraph/guides/interrupts' }}
        visual={<MediumSwitcher sectionId="approve" panes={approvePanes} />}
      />

      {/* Render */}
      <FeatureBlock
        id="render"
        eyebrow="Render"
        headline="Agent output becomes components from your design system."
        body="The agent emits constrained structured output. Angular renders registered components — json-render and A2UI both speak it — with per-component fallback and a readiness gate. No generated code runs."
        rows={[
          { claim: 'Your design system, not a chat widget', api: '@threadplane/render' },
          { claim: 'Unknown specs degrade per component', api: 'fallback + readiness gate' },
          { claim: 'Schema on the server, trust in the client', api: 'validated specs' },
        ]}
        cta={{ label: 'See @threadplane/render', href: '/render' }}
        visualLeft
        visual={<MediumSwitcher sectionId="render" panes={renderPanes} />}
      />

      {/* Test */}
      <FeatureBlock
        id="test"
        eyebrow="Test"
        headline="Verify UI behavior without a model or backend."
        body={
          <>
            <code className="home-code">provideFakeAgent()</code> streams canned tokens in-process; mock transports
            script tool calls and interrupts. Your component specs stay deterministic and fast.
          </>
        }
        rows={[
          { claim: 'No key, no server, no network', api: 'provideFakeAgent()' },
          { claim: 'Script tool calls and interrupts', api: 'mockLangGraphAgent()' },
          { claim: 'Same UI code in test and production', api: 'Agent' },
        ]}
        cta={{ label: 'Try without a backend', href: INSTALL_OPTIONS[0].quickstartHref }}
        visual={<MediumSwitcher sectionId="test" panes={testPanes} />}
      />

      {/* Interactive demo showcase */}
      <Section surface="canvas">
        <Container>
          <DemoShowcase />
        </Container>
      </Section>

      <CodingAgentQuickstart />
      <ScopeTable />
      <WhitePaperBlock formPolicy={formPolicy} />
      <PilotBlock />
      <HomeFAQ />
      <FinalCTA
        variant="dark"
        headline="Prove the Angular UI before you connect the backend."
        subtext="Start with a fake agent, render a real Threadplane surface, then swap in LangGraph or AG-UI when the integration is ready."
        primary={{ label: 'Start the quickstart', href: INSTALL_OPTIONS[0].quickstartHref, ctaId: 'hero_quickstart' }}
        secondary={{ label: 'Run live examples', href: HERO_SECONDARY_HREF, ctaId: 'hero_live_demo' }}
        caption="MIT · no account, no cloud"
        captionLink={{ label: 'Talk to an engineer', href: '/contact' }}
      />
      <RecentArticles />
    </>
  );
}
