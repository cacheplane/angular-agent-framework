'use client';
import { motion } from 'framer-motion';
import { tokens } from '../../../lib/design-tokens';

const LAYERS = [
  {
    id: 'sr',
    tag: 'Primitives',
    pkg: '@cacheplane/angular',
    color: tokens.colors.accent,
    rgb: '0,64,144',
    bg: 'rgba(0,64,144,0.05)',
    border: 'rgba(0,64,144,0.25)',
    outcome: 'Ship streaming agents without building the plumbing.',
    problem: 'Wiring SSE into Angular requires weeks of zone patching, manual subscription management, and custom thread-persistence code — most of which breaks under load or after a page refresh.',
    solution: 'agent() gives your team production-ready streaming, thread persistence, interrupt handling, and a deterministic test transport on day one.',
    chips: ['agent()', 'messages()', 'interrupt()', 'time travel', 'MockAgentTransport'],
    connLabel: 'AIMessage stream',
    connColor: 'rgba(0,64,144,.22)',
    connFill: '#004090',
    connDur: '1.1',
    connOffset: '0.55',
    pathId: 'path-sr',
  },
  {
    id: 'chat',
    tag: 'UI Layer',
    pkg: '@cacheplane/chat',
    color: '#5a00c8',
    rgb: '90,0,200',
    bg: 'rgba(90,0,200,0.05)',
    border: 'rgba(90,0,200,0.25)',
    outcome: 'Accessible agent UI in days, not sprints.',
    problem: 'Approval flows, streaming indicators, tool-call cards, and interrupt panels are rebuilt from scratch by every team — typically a 4–6 week sprint that delays the real agent work.',
    solution: 'Pre-built, accessible Angular components for every agent interaction pattern. Your team configures and styles them — not writes them.',
    chips: ['<chat-messages>', '<chat-interrupt>', '<chat-tool-calls>', '<chat> prebuilt', '<chat-debug>'],
    connLabel: 'Signal<Message[]>',
    connColor: 'rgba(26,122,64,.22)',
    connFill: '#1a7a40',
    connDur: '1.3',
    connOffset: '0.65',
    pathId: 'path-chat',
  },
  {
    id: 'render',
    tag: 'Gen UI',
    pkg: '@cacheplane/render',
    color: '#1a7a40',
    rgb: '26,122,64',
    bg: 'rgba(26,122,64,0.05)',
    border: 'rgba(26,122,64,0.25)',
    outcome: 'Agents that render UI — without coupling them to your frontend.',
    problem: 'Agents that surface dynamic data require either hardcoded frontend logic per agent or a fragile coupling between agent output and component code — both block iteration speed.',
    solution: 'The agent emits a declarative UI spec. Your Angular registry maps it to components. Swap components or redesign the UI without touching the agent.',
    chips: ['<render-spec>', 'defineAngularRegistry()', 'signalStateStore()', 'JSON patch streaming'],
    connLabel: 'Spec · JSON patch',
    connColor: '',
    connFill: '',
    connDur: '',
    connOffset: '',
    pathId: '',
  },
];

const NOW_ITEMS = [
  'Text streaming', 'Tool-call cards', 'Interrupt flows',
  'Generative UI specs', 'Thread persistence', 'Deterministic testing',
];
const SOON_ITEMS = ['File attachments', 'Image inputs & rendering', 'Audio input', 'Multi-modal messages'];
const HORIZON_ITEMS = ['Voice UI primitives', 'Video stream rendering', 'Collaborative agents'];

function Connector({ layer }: { layer: typeof LAYERS[0] }) {
  if (!layer.connFill) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', height: 52 }}>
      <svg width="4" height="52" viewBox="0 0 4 52" overflow="visible">
        <line x1="2" y1="0" x2="2" y2="52" stroke={layer.connColor} strokeWidth="2" strokeDasharray="3 3" />
        <circle r="3.5" fill={layer.connFill}>
          <animateMotion dur={`${layer.connDur}s`} repeatCount="indefinite" begin="0s">
            <mpath href={`#${layer.pathId}`} />
          </animateMotion>
          <animate attributeName="opacity" values="0;1;1;0" dur={`${layer.connDur}s`} repeatCount="indefinite" begin="0s" />
        </circle>
        <circle r="3.5" fill={layer.connFill}>
          <animateMotion dur={`${layer.connDur}s`} repeatCount="indefinite" begin={`${layer.connOffset}s`}>
            <mpath href={`#${layer.pathId}`} />
          </animateMotion>
          <animate attributeName="opacity" values="0;1;1;0" dur={`${layer.connDur}s`} repeatCount="indefinite" begin={`${layer.connOffset}s`} />
        </circle>
        <path id={layer.pathId} d="M2,0 L2,52" style={{ display: 'none' }} />
      </svg>
      <span style={{
        position: 'absolute',
        left: 'calc(50% + 10px)',
        fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
        fontSize: '0.56rem',
        color: '#aaa',
        whiteSpace: 'nowrap',
        top: '50%',
        transform: 'translateY(-50%)',
      }}>
        {layer.connLabel}
      </span>
    </div>
  );
}

export function FullStackSection() {
  return (
    <section style={{ padding: '80px 32px' }}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        style={{ textAlign: 'center', marginBottom: 48 }}
      >
        <p style={{
          fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
          fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.12em',
          fontWeight: 700, color: tokens.colors.accent, marginBottom: 14,
        }}>
          The Complete Angular Agent Stack
        </p>
        <h2 style={{
          fontFamily: 'var(--font-garamond,"EB Garamond",Georgia,serif)',
          fontSize: 'clamp(26px,3.5vw,46px)', fontWeight: 800, lineHeight: 1.1,
          color: tokens.colors.textPrimary, marginBottom: 10,
        }}>
          Three packages. One architecture.<br />
          <span style={{ color: tokens.colors.accent }}>Nothing left to wire yourself.</span>
        </h2>
        <p style={{
          fontFamily: 'var(--font-garamond,"EB Garamond",Georgia,serif)',
          fontStyle: 'italic', fontSize: '1.05rem', color: tokens.colors.textSecondary,
          maxWidth: 520, margin: '0 auto',
        }}>
          LangGraph signals flow top to bottom through each layer — primitives to UI to generative components.
        </p>
      </motion.div>

      {/* Stack diagram */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.2 }}
        style={{ maxWidth: 520, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
      >
        {/* LangGraph source */}
        <div style={{
          alignSelf: 'center', width: 220,
          background: '#1a1b26', borderRadius: 14, padding: '13px 18px', textAlign: 'center',
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <p style={{ fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)', fontSize: '0.58rem', color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            LangGraph Cloud
          </p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(76,175,80,.1)', border: '1px solid rgba(76,175,80,.2)', borderRadius: 6, padding: '3px 10px' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#4caf50', display: 'inline-block', animation: 'sr-pulse 0.9s infinite' }} />
            <span style={{ fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)', fontSize: '0.62rem', color: '#8bc48b', fontWeight: 600 }}>stream active</span>
          </div>
        </div>

        {/* Layers with connectors */}
        {LAYERS.map((layer) => (
          <div key={layer.id}>
            <Connector layer={layer} />
            <div style={{
              borderRadius: 14,
              padding: '20px 20px 18px',
              background: layer.bg,
              border: `2px solid ${layer.border}`,
            }}>
              {/* Tag — inline, not absolute. Fixes Gen UI overlap bug. */}
              <span style={{
                display: 'inline-block',
                fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
                fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
                padding: '2px 9px', borderRadius: 5, color: '#fff', background: layer.color,
                marginBottom: 10,
              }}>
                {layer.tag}
              </span>

              {/* Package name */}
              <p style={{
                fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
                fontSize: '0.76rem', fontWeight: 700, color: layer.color,
                marginBottom: 8,
              }}>
                {layer.pkg}
              </p>

              {/* Outcome headline */}
              <p style={{
                fontFamily: 'var(--font-garamond,"EB Garamond",Georgia,serif)',
                fontSize: '1.18rem', fontWeight: 700, color: tokens.colors.textPrimary,
                lineHeight: 1.25, marginBottom: 10,
              }}>
                {layer.outcome}
              </p>

              {/* "Without this" problem block */}
              <div style={{
                padding: '8px 12px',
                borderRadius: 6,
                background: 'rgba(183,28,28,0.04)',
                borderLeft: '2px solid rgba(183,28,28,0.25)',
                marginBottom: 12,
              }}>
                <span style={{
                  display: 'block',
                  fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
                  fontSize: '0.52rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                  color: '#b71c1c', marginBottom: 4,
                }}>
                  Without this
                </span>
                <p style={{ fontSize: '0.75rem', lineHeight: 1.6, color: '#555', margin: 0 }}>
                  {layer.problem}
                </p>
              </div>

              {/* Solution line */}
              <p style={{ fontSize: '0.8rem', lineHeight: 1.6, color: '#333', marginBottom: 14 }}>
                {layer.solution}
              </p>

              {/* API chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {layer.chips.map(chip => (
                  <span key={chip} style={{
                    fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
                    fontSize: '0.58rem', padding: '2px 8px', borderRadius: 4,
                    background: `rgba(${layer.rgb},.07)`, color: layer.color, border: `1px solid rgba(${layer.rgb},.15)`,
                  }}>
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Roadmap strip */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.3 }}
        style={{
          maxWidth: 800, margin: '40px auto 0',
          padding: '28px 36px',
          borderRadius: 18,
          background: tokens.glass.bg,
          backdropFilter: `blur(${tokens.glass.blur})`,
          WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
          border: `1px solid ${tokens.glass.border}`,
          boxShadow: tokens.glass.shadow,
          display: 'grid',
          gridTemplateColumns: 'repeat(3,1fr)',
          gap: 32,
        }}
      >
        {/* Now */}
        <div>
          <p style={{ fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#1a7a40', paddingBottom: 10, borderBottom: '1px solid rgba(0,0,0,.07)', marginBottom: 14 }}>
            Available now
          </p>
          {NOW_ITEMS.map(item => (
            <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.79rem', color: '#555', marginBottom: 9 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1a7a40', flexShrink: 0 }} />
              {item}
            </div>
          ))}
        </div>
        {/* Soon */}
        <div>
          <p style={{ fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#c47a00', paddingBottom: 10, borderBottom: '1px solid rgba(0,0,0,.07)', marginBottom: 14 }}>
            Coming soon{' '}
            <span style={{ fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)', fontSize: '0.58rem', fontWeight: 700, background: 'rgba(196,122,0,.1)', border: '1px solid rgba(196,122,0,.25)', color: '#c47a00', padding: '1px 6px', borderRadius: 4 }}>
              Planned
            </span>
          </p>
          {SOON_ITEMS.map(item => (
            <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.79rem', color: '#555', marginBottom: 9 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#c47a00', flexShrink: 0 }} />
              {item}
            </div>
          ))}
        </div>
        {/* Horizon */}
        <div>
          <p style={{ fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#999', paddingBottom: 10, borderBottom: '1px solid rgba(0,0,0,.07)', marginBottom: 14 }}>
            On the horizon
          </p>
          {HORIZON_ITEMS.map(item => (
            <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.79rem', color: '#888', marginBottom: 9 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ccc', flexShrink: 0 }} />
              {item}
            </div>
          ))}
        </div>
      </motion.div>

      <style>{`
        @keyframes sr-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.6)} }
      `}</style>
    </section>
  );
}
