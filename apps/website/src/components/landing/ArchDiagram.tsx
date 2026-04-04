'use client';
import { motion } from 'framer-motion';
import { tokens } from '../../../lib/design-tokens';

const NODES = [
  { id: 'angular', label: 'Angular App', x: 60, y: 100 },
  { id: 'sr', label: 'streamResource()', x: 260, y: 100 },
  { id: 'transport', label: 'FetchStreamTransport', x: 480, y: 100 },
  { id: 'langgraph', label: 'LangGraph Server', x: 700, y: 100 },
];

const EDGES = [
  { from: 'angular', to: 'sr', d: 'M 140 100 L 260 100' },
  { from: 'sr', to: 'transport', d: 'M 390 100 L 480 100' },
  { from: 'transport', to: 'langgraph', d: 'M 620 100 L 700 100' },
];

export function ArchDiagram() {
  return (
    <section className="px-8 py-16 flex flex-col items-center">
      <p className="font-mono text-xs uppercase tracking-widest mb-8"
        style={{ color: tokens.colors.accent }}>Architecture</p>
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}>
        <svg role="img" viewBox="0 0 820 200" width="100%" style={{ maxWidth: 820 }} aria-label="Architecture diagram showing Angular App connecting through streamResource and FetchStreamTransport to LangGraph Server">
          <defs>
            <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(0,64,144,0.15)" />
              <stop offset="100%" stopColor="rgba(0,64,144,0)" />
            </radialGradient>
          </defs>
          {EDGES.map((edge) => (
            <g key={edge.from}>
              <path d={edge.d} stroke={tokens.colors.accent} strokeWidth="1.5" fill="none" opacity="0.4" />
              <circle r="3" fill={tokens.colors.accent}>
                <animateMotion dur="2s" repeatCount="indefinite" path={edge.d} />
              </circle>
            </g>
          ))}
          {NODES.map((node) => (
            <g key={node.id}>
              <ellipse cx={node.x + 10} cy={node.y} rx={50} ry={30} fill="url(#nodeGlow)" />
              <rect
                x={node.x - 60} y={node.y - 24}
                width="140" height="48"
                rx="6"
                fill="rgba(255,255,255,0.5)"
                stroke={tokens.colors.accentBorder}
                strokeWidth="1"
              />
              <text
                x={node.x + 10} y={node.y + 5}
                textAnchor="middle"
                fill={tokens.colors.textSecondary}
                fontSize="11"
                fontFamily="var(--font-mono)">
                {node.label}
              </text>
            </g>
          ))}
        </svg>
      </motion.div>
    </section>
  );
}
