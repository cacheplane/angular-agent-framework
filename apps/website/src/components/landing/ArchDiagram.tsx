'use client';
import { motion } from 'framer-motion';
import { tokens } from '../../../lib/design-tokens';

// ── Layout constants ────────────────────────────────────────────────────────
const NODE_W = 160;
const NODE_H = 56;
const ROW_TOP = 80;
const ROW_BOT = 260;

// ── Node definitions ────────────────────────────────────────────────────────
// cx/cy = center of each node box
const NODES = [
  // Angular side – top row
  {
    id: 'angular',
    label: 'Angular App',
    subtitle: 'Components & Signals',
    cx: 120,
    cy: ROW_TOP,
    side: 'angular' as const,
  },
  {
    id: 'sr',
    label: 'streamResource()',
    subtitle: 'Reactive Bridge',
    cx: 330,
    cy: ROW_TOP,
    side: 'angular' as const,
  },
  {
    id: 'transport',
    label: 'FetchStreamTransport',
    subtitle: 'SSE Connection',
    cx: 560,
    cy: ROW_TOP,
    side: 'angular' as const,
  },
  // LangGraph side – bottom row
  {
    id: 'langgraph',
    label: 'LangGraph Cloud',
    subtitle: 'Platform API',
    cx: 560,
    cy: ROW_BOT,
    side: 'langgraph' as const,
  },
  {
    id: 'agent',
    label: 'Agent Graph',
    subtitle: 'State Machine',
    cx: 350,
    cy: ROW_BOT,
    side: 'langgraph' as const,
  },
  {
    id: 'tools',
    label: 'Tool Nodes',
    subtitle: 'Actions & APIs',
    cx: 140,
    cy: ROW_BOT,
    side: 'langgraph' as const,
  },
];

// Helper: left/right edge x offsets for a node center
const lx = (cx: number) => cx - NODE_W / 2;
const rx = (cx: number) => cx + NODE_W / 2;

// ── Edge definitions ─────────────────────────────────────────────────────────
// d = SVG path string, label = optional annotation text, lx/ly = label position
const EDGES = [
  // Top row: Angular → streamResource
  {
    id: 'e-angular-sr',
    d: `M ${rx(120)} ${ROW_TOP} L ${lx(330)} ${ROW_TOP}`,
    label: 'Signal updates',
    lx: (rx(120) + lx(330)) / 2,
    ly: ROW_TOP - 10,
    color: tokens.colors.angularRed,
    opacity: 0.5,
    particleDur: '2.2s',
  },
  // Top row: streamResource → FetchStreamTransport
  {
    id: 'e-sr-transport',
    d: `M ${rx(330)} ${ROW_TOP} L ${lx(560)} ${ROW_TOP}`,
    label: 'Stream events',
    lx: (rx(330) + lx(560)) / 2,
    ly: ROW_TOP - 10,
    color: tokens.colors.angularRed,
    opacity: 0.5,
    particleDur: '1.8s',
  },
  // Vertical: FetchStreamTransport ↔ LangGraph Cloud
  {
    id: 'e-vertical',
    d: `M ${560} ${ROW_TOP + NODE_H / 2} L ${560} ${ROW_BOT - NODE_H / 2}`,
    label: 'SSE Stream ↑  HTTP POST ↓',
    lx: 560 + 8,
    ly: (ROW_TOP + NODE_H / 2 + ROW_BOT - NODE_H / 2) / 2,
    color: tokens.colors.accent,
    opacity: 0.5,
    particleDur: '2.0s',
  },
  // Bottom row: LangGraph Cloud → Agent Graph
  {
    id: 'e-langgraph-agent',
    d: `M ${lx(560)} ${ROW_BOT} L ${rx(350)} ${ROW_BOT}`,
    label: 'State transitions',
    lx: (lx(560) + rx(350)) / 2,
    ly: ROW_BOT + 16,
    color: tokens.colors.accent,
    opacity: 0.5,
    particleDur: '2.4s',
  },
  // Bottom row: Agent Graph → Tool Nodes
  {
    id: 'e-agent-tools',
    d: `M ${lx(350)} ${ROW_BOT} L ${rx(140)} ${ROW_BOT}`,
    label: 'Tool calls',
    lx: (lx(350) + rx(140)) / 2,
    ly: ROW_BOT + 16,
    color: tokens.colors.accent,
    opacity: 0.5,
    particleDur: '2.0s',
  },
];

// ── Color scheme per side ────────────────────────────────────────────────────
const STYLE = {
  angular: {
    fill: 'rgba(255,240,243,0.5)',
    stroke: 'rgba(221,0,49,0.2)',
  },
  langgraph: {
    fill: 'rgba(234,243,255,0.5)',
    stroke: 'rgba(0,64,144,0.2)',
  },
};

// ── Component ────────────────────────────────────────────────────────────────
export function ArchDiagram() {
  return (
    <section className="px-8 py-16 flex flex-col items-center">
      <p
        className="font-mono text-xs uppercase tracking-widest mb-8"
        style={{ color: tokens.colors.accent }}
      >
        Architecture
      </p>

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        style={{ width: '100%', maxWidth: 820 }}
      >
        <svg
          role="img"
          viewBox="0 0 820 350"
          width="100%"
          aria-label="Architecture diagram showing Angular App connecting through streamResource and FetchStreamTransport via SSE to LangGraph Cloud, Agent Graph, and Tool Nodes"
        >
          <defs>
            {/* Glow gradient reused for all nodes */}
            <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(0,64,144,0.12)" />
              <stop offset="100%" stopColor="rgba(0,64,144,0)" />
            </radialGradient>
          </defs>

          {/* ── Edges ── */}
          {EDGES.map((edge) => (
            <g key={edge.id}>
              {/* Static line */}
              <path
                d={edge.d}
                stroke={edge.color}
                strokeWidth="1.5"
                fill="none"
                opacity={edge.opacity}
                strokeDasharray={edge.id === 'e-vertical' ? '4 3' : undefined}
              />
              {/* Animated particle */}
              <circle r="3" fill={edge.color} opacity="0.9">
                <animateMotion
                  dur={edge.particleDur}
                  repeatCount="indefinite"
                  path={edge.d}
                />
              </circle>
              {/* Edge label */}
              {edge.label && (
                <text
                  x={edge.lx}
                  y={edge.ly}
                  textAnchor={edge.id === 'e-vertical' ? 'start' : 'middle'}
                  fill={tokens.colors.textMuted}
                  fontSize="8"
                  fontFamily="var(--font-mono)"
                >
                  {edge.label}
                </text>
              )}
            </g>
          ))}

          {/* ── Nodes ── */}
          {NODES.map((node) => {
            const x = node.cx - NODE_W / 2;
            const y = node.cy - NODE_H / 2;
            const style = STYLE[node.side];
            return (
              <g key={node.id}>
                {/* Soft glow behind node */}
                <ellipse
                  cx={node.cx}
                  cy={node.cy}
                  rx={NODE_W / 2 + 10}
                  ry={NODE_H / 2 + 10}
                  fill="url(#nodeGlow)"
                />
                {/* Node box */}
                <rect
                  x={x}
                  y={y}
                  width={NODE_W}
                  height={NODE_H}
                  rx="8"
                  fill={style.fill}
                  stroke={style.stroke}
                  strokeWidth="1.5"
                />
                {/* Primary label */}
                <text
                  x={node.cx}
                  y={node.cy - 4}
                  textAnchor="middle"
                  fill={tokens.colors.textSecondary}
                  fontSize="11"
                  fontFamily="var(--font-mono)"
                  fontWeight="500"
                >
                  {node.label}
                </text>
                {/* Subtitle */}
                <text
                  x={node.cx}
                  y={node.cy + 12}
                  textAnchor="middle"
                  fill={tokens.colors.textMuted}
                  fontSize="9"
                  fontFamily="var(--font-mono)"
                >
                  {node.subtitle}
                </text>
              </g>
            );
          })}
        </svg>
      </motion.div>
    </section>
  );
}
