'use client';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { tokens } from '@ngaf/design-tokens';

const LIBRARIES = [
  {
    id: 'angular',
    tag: 'Agent',
    pkg: '@ngaf/langgraph',
    color: tokens.colors.accent,
    rgb: '0,64,144',
    headline: 'The reactive bridge to LangGraph',
    description: 'Signal-native streaming connects your Angular templates directly to LangGraph agent state. Interrupts, persistence, time-travel, and branch history \u2014 every LangGraph feature has a first-class Angular API. Test deterministically with MockAgentTransport.',
    pills: ['Angular Signals', 'LangGraph Cloud', 'MockAgentTransport'],
    href: '/angular',
    ctaLabel: 'Explore Agent',
  },
  {
    id: 'render',
    tag: 'Gen UI',
    pkg: '@ngaf/render',
    color: tokens.colors.renderGreen,
    rgb: '26,122,64',
    headline: 'Agents that render UI \u2014 on open standards',
    description: "Built on Vercel\u2019s json-render spec and Google\u2019s A2UI protocol. Your agent emits a render spec, your Angular components render it \u2014 with streaming JSON patches, component registries, and signal-native state. No coupling between agent logic and frontend.",
    pills: ['Vercel json-render', 'Google A2UI', 'JSON Patch streaming'],
    href: '/render',
    ctaLabel: 'Explore Render',
  },
  {
    id: 'chat',
    tag: 'Chat',
    pkg: '@ngaf/chat',
    color: tokens.colors.chatPurple,
    rgb: '90,0,200',
    headline: 'Production chat UI in days, not sprints',
    description: 'Every component you need \u2014 streaming messages, tool call cards, interrupt panels, generative UI, debug overlay, theming \u2014 pre-built, composable, and WCAG accessible. Built on the Agent and Render libraries so everything works together from day one.',
    pills: ['<chat-messages>', '<chat-debug>', 'WCAG accessible'],
    href: '/chat',
    ctaLabel: 'Explore Chat',
  },
  {
    id: 'ag-ui',
    tag: 'AG-UI',
    pkg: '@ngaf/ag-ui',
    color: tokens.colors.accent,
    rgb: '0,64,144',
    headline: 'Run any AG-UI compatible backend',
    description: "AG-UI is the open agent-to-UI protocol used by CrewAI, Mastra, Microsoft Agent Framework, AG2, Pydantic AI, AWS Strands, and the CopilotKit runtime. The @ngaf/ag-ui adapter wraps an AbstractAgent into the same Agent contract @ngaf/chat consumes — same UI, different runtime.",
    pills: ['CrewAI', 'Mastra', 'Microsoft AF', 'CopilotKit'],
    href: 'https://github.com/cacheplane/angular-agent-framework/tree/main/libs/ag-ui',
    ctaLabel: 'Explore AG-UI',
  },
];

function Connector({ fromRgb, toRgb }: { fromRgb: string; toRgb: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '2px 0' }}>
      <div style={{
        width: 2,
        height: 28,
        background: `linear-gradient(to bottom, rgba(${fromRgb}, 0.3), rgba(${toRgb}, 0.3))`,
        borderRadius: 1,
      }} />
    </div>
  );
}

export function TheStack() {
  return (
    <section className="the-stack" style={{ padding: '80px 32px' }}>
      <style>{`
        @media (max-width: 767px) {
          .the-stack { padding: 60px 20px !important; }
          .the-stack-card { padding: 24px 20px 20px !important; }
        }
      `}</style>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        style={{ textAlign: 'center', marginBottom: 48 }}
      >
        <p style={{
          fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
          fontSize: '0.7rem',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          fontWeight: 700,
          color: tokens.colors.accent,
          marginBottom: 14,
        }}>
          The Cacheplane Stack
        </p>
        <h2 style={{
          fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
          fontSize: 'clamp(26px, 3.5vw, 46px)',
          fontWeight: 800,
          lineHeight: 1.1,
          color: tokens.colors.textPrimary,
          marginBottom: 10,
        }}>
          Four libraries. One architecture.<br />
          Every layer you need.
        </h2>
        <p style={{
          fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
          fontStyle: 'italic',
          fontSize: '1.05rem',
          color: tokens.colors.textSecondary,
          maxWidth: 520,
          margin: '0 auto',
        }}>
          Whatever your agent runtime — LangGraph, AG-UI, or your own backend — these libraries ship it.
        </p>
      </motion.div>

      <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
        {LIBRARIES.map((lib, i) => (
          <div key={lib.id}>
            {i > 0 && (
              <Connector
                fromRgb={LIBRARIES[i - 1].rgb}
                toRgb={lib.rgb}
              />
            )}
            <motion.div
              className="the-stack-card"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              style={{
                background: `rgba(${lib.rgb}, 0.03)`,
                border: `1px solid rgba(${lib.rgb}, 0.15)`,
                borderRadius: 14,
                padding: '28px 28px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <span style={{
                display: 'inline-block',
                alignSelf: 'flex-start',
                fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                fontSize: '0.58rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                padding: '2px 9px',
                borderRadius: 5,
                color: '#fff',
                background: lib.color,
              }}>
                {lib.tag}
              </span>

              <p style={{
                fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                fontSize: '0.76rem',
                fontWeight: 700,
                color: lib.color,
                margin: 0,
              }}>
                {lib.pkg}
              </p>

              <h3 style={{
                fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
                fontSize: '1.3rem',
                fontWeight: 700,
                color: tokens.colors.textPrimary,
                lineHeight: 1.25,
                margin: 0,
              }}>
                {lib.headline}
              </h3>

              <p style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.88rem',
                color: tokens.colors.textSecondary,
                lineHeight: 1.6,
                margin: 0,
              }}>
                {lib.description}
              </p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {lib.pills.map(pill => (
                  <span key={pill} style={{
                    fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                    fontSize: '0.58rem',
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: `rgba(${lib.rgb}, 0.07)`,
                    color: lib.color,
                    border: `1px solid rgba(${lib.rgb}, 0.15)`,
                  }}>
                    {pill}
                  </span>
                ))}
              </div>

              <Link
                href={lib.href}
                style={{
                  fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: lib.color,
                  textDecoration: 'none',
                  marginTop: 4,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {lib.ctaLabel} →
              </Link>
            </motion.div>
          </div>
        ))}
      </div>
    </section>
  );
}
