import { Hero } from '../components/landing/Hero';
import { ProofStrip } from '../components/landing/ProofStrip';
import { Differentiator } from '../components/landing/Differentiator';
import { FeatureBlock } from '../components/landing/FeatureBlock';
import { BrowserFrame } from '../components/ui/BrowserFrame';
import { LiveCockpitFrame } from '../components/landing/LiveCockpitFrame';
import { PilotBlock } from '../components/landing/PilotBlock';
import { WhitePaperBlock } from '../components/landing/WhitePaperBlock';
import { Promises } from '../components/landing/Promises';
import { HomeFAQ } from '../components/landing/HomeFAQ';
import { FinalCTA } from '../components/landing/FinalCTA';
import { tokens } from '@ngaf/design-tokens';

export default async function HomePage() {
  return (
    <>
      <Hero />
      <ProofStrip />
      <Differentiator />

      {/* Stream */}
      <FeatureBlock
        id="stream"
        eyebrow="Stream"
        headline="Stream tokens to Angular signals — no glue code."
        body={
          <>
            <code style={{ fontFamily: tokens.typography.fontMono }}>provideAgent</code> + <code style={{ fontFamily: tokens.typography.fontMono }}>agent()</code> give you signals for messages, status, errors, and interrupts. LangGraph and AG-UI adapters share the contract — swap runtimes without rewriting the UI.
          </>
        }
        bullets={[
          'Token-level streaming straight into Angular signals',
          'Thread state, interrupts, tool progress, branch/history',
          'Adapters: LangGraph (@ngaf/langgraph), AG-UI (@ngaf/ag-ui)',
          'One contract, swappable runtimes',
        ]}
        supportingCards={[
          { title: 'provideAgent', description: 'Wire the agent into your app.config.ts.' },
          { title: 'AgUiAdapter', description: 'Any AG-UI compliant backend.' },
          { title: 'LangGraphAdapter', description: 'Native LangGraph streaming.' },
        ]}
        cta={{ label: 'Read the streaming guide', href: '/docs/agent/api/agent' }}
        visual={
          <BrowserFrame url="cockpit.cacheplane.ai/chat" elevation="md">
            <div
              style={{
                padding: 28,
                background: 'linear-gradient(180deg, #fff 0%, #f8fafc 100%)',
                minHeight: 320,
              }}
            >
              <div
                style={{
                  fontFamily: tokens.typography.fontMono,
                  fontSize: 11,
                  color: tokens.colors.textMuted,
                  marginBottom: 12,
                }}
              >
                ASSISTANT · streaming
              </div>
              <div
                style={{
                  fontFamily: tokens.typography.fontSans,
                  fontSize: 14,
                  color: tokens.colors.textPrimary,
                  lineHeight: 1.6,
                }}
              >
                Building the Angular chat surface from your existing component library. Tool call results render as Angular components, not raw JSON.
                <span
                  style={{
                    display: 'inline-block',
                    width: 6,
                    height: 14,
                    background: tokens.colors.accent,
                    marginLeft: 2,
                    verticalAlign: 'middle',
                    animation: 'blink 1s steps(2) infinite',
                  }}
                />
              </div>
              <div
                style={{
                  marginTop: 20,
                  paddingTop: 16,
                  borderTop: `1px solid ${tokens.surfaces.border}`,
                  fontFamily: tokens.typography.fontMono,
                  fontSize: 11,
                  color: tokens.colors.textSecondary,
                }}
              >
                tools: render_card · search_docs · stream complete
              </div>
            </div>
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
          'A2UI v1 protocol + Vercel json-render adapter',
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
          <BrowserFrame url="cockpit.cacheplane.ai/render" elevation="md">
            <div
              style={{
                padding: 28,
                background: tokens.surfaces.surface,
                minHeight: 320,
              }}
            >
              <div
                style={{
                  background: tokens.surfaces.surfaceTinted,
                  border: `1px solid ${tokens.surfaces.border}`,
                  borderRadius: tokens.radius.md,
                  padding: 16,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    fontFamily: tokens.typography.fontMono,
                    fontSize: 11,
                    color: tokens.colors.accent,
                    marginBottom: 8,
                  }}
                >
                  AI-rendered · Angular component
                </div>
                <div
                  style={{
                    fontFamily: tokens.typography.fontSerif,
                    fontSize: 18,
                    fontWeight: 700,
                    color: tokens.colors.textPrimary,
                    marginBottom: 6,
                  }}
                >
                  Q3 revenue: $4.2M
                </div>
                <div
                  style={{
                    fontFamily: tokens.typography.fontSans,
                    fontSize: 13,
                    color: tokens.colors.textSecondary,
                    lineHeight: 1.5,
                  }}
                >
                  +18% vs Q2. Driven by enterprise upsells in the EU.
                </div>
              </div>
              <div
                style={{
                  background: tokens.colors.accentSurface,
                  border: `1px dashed ${tokens.colors.accentBorder}`,
                  borderRadius: tokens.radius.sm,
                  padding: '8px 12px',
                  fontFamily: tokens.typography.fontMono,
                  fontSize: 11,
                  color: tokens.colors.accent,
                }}
              >
                fallback ready · readiness gate ✓
              </div>
            </div>
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
        cta={{ label: 'Production patterns', href: '/docs/agent/guides/production' }}
        visual={<LiveCockpitFrame />}
      />

      <PilotBlock />
      <WhitePaperBlock />
      <Promises />
      <HomeFAQ />
      <FinalCTA />
    </>
  );
}
