'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { tokens } from '@ngaf/design-tokens';

// ── Node data ───────────────────────────────────────────────────────────────
interface NodeDef {
  id: string;
  label: string;
  subtitle: string;
  description: string;
  side: 'angular' | 'bridge' | 'langgraph';
  icon: string;
}

const NODES: NodeDef[] = [
  {
    id: 'angular',
    label: 'Angular App',
    subtitle: 'Components & Signals',
    description: 'Your Angular components call agent() and bind the returned Signals directly in templates. OnPush change detection handles re-renders automatically.',
    side: 'angular',
    icon: '🅰️',
  },
  {
    id: 'sr',
    label: 'agent()',
    subtitle: 'Reactive Bridge',
    description: 'The core primitive. Creates a reactive resource that exposes messages, status, error, and threadId as Angular Signals. Manages the full agent lifecycle — streaming, interrupts, branching, and thread persistence.',
    side: 'bridge',
    icon: '🔗',
  },
  {
    id: 'transport',
    label: 'FetchStreamTransport',
    subtitle: 'SSE Connection',
    description: 'Handles the HTTP/SSE transport layer. Opens a server-sent events connection to LangGraph Cloud, parses streaming chunks, and feeds them into the resource. Swappable with MockAgentTransport for testing.',
    side: 'bridge',
    icon: '📡',
  },
  {
    id: 'langgraph',
    label: 'LangGraph Cloud',
    subtitle: 'Platform API',
    description: 'The hosted LangGraph platform. Receives HTTP POST requests to start runs, streams results back via SSE, and manages thread state, checkpoints, and agent routing.',
    side: 'langgraph',
    icon: '☁️',
  },
  {
    id: 'agent',
    label: 'Agent Graph',
    subtitle: 'State Machine',
    description: 'Your LangGraph agent definition — a directed graph of nodes with conditional edges. Manages state transitions, supports interrupts for human-in-the-loop, and enables time-travel debugging via checkpoints.',
    side: 'langgraph',
    icon: '🔄',
  },
  {
    id: 'tools',
    label: 'Tool Nodes',
    subtitle: 'Actions & APIs',
    description: 'Individual tool implementations that the agent can invoke — database queries, API calls, code execution, file operations. Each tool node receives state, performs an action, and returns updated state.',
    side: 'langgraph',
    icon: '🔧',
  },
];

// ── Edge data ───────────────────────────────────────────────────────────────
const EDGES = [
  { from: 'angular', to: 'sr', label: 'Signal updates' },
  { from: 'sr', to: 'transport', label: 'Stream events' },
  { from: 'transport', to: 'langgraph', label: 'SSE ↑ HTTP ↓' },
  { from: 'langgraph', to: 'agent', label: 'State transitions' },
  { from: 'agent', to: 'tools', label: 'Tool calls' },
];

// ── Style helpers ───────────────────────────────────────────────────────────
const sideStyle = {
  angular: {
    bg: 'rgba(255, 240, 243, 0.45)',
    border: 'rgba(221, 0, 49, 0.2)',
    activeBorder: 'rgba(221, 0, 49, 0.5)',
    glow: '0 0 30px rgba(221, 0, 49, 0.1)',
    dotColor: tokens.colors.angularRed,
  },
  bridge: {
    bg: 'rgba(245, 240, 255, 0.45)',
    border: 'rgba(100, 80, 200, 0.2)',
    activeBorder: 'rgba(100, 80, 200, 0.5)',
    glow: '0 0 30px rgba(100, 80, 200, 0.1)',
    dotColor: '#7C5FCF',
  },
  langgraph: {
    bg: 'rgba(234, 243, 255, 0.45)',
    border: 'rgba(0, 64, 144, 0.2)',
    activeBorder: 'rgba(0, 64, 144, 0.5)',
    glow: '0 0 30px rgba(0, 64, 144, 0.1)',
    dotColor: tokens.colors.accent,
  },
};

export function ArchDiagram() {
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const active = NODES.find((n) => n.id === activeNode);

  return (
    <section className="px-8 py-24 max-w-4xl mx-auto">
      <p className="font-mono text-xs uppercase tracking-widest mb-4 text-center"
        style={{ color: tokens.colors.accent }}>Architecture</p>
      <h2 style={{
        fontFamily: 'var(--font-garamond)',
        fontWeight: 800,
        fontSize: 'clamp(28px, 3.5vw, 48px)',
        color: tokens.colors.textPrimary,
        textAlign: 'center',
        marginBottom: 16,
      }}>How it works</h2>
      <p className="text-center mb-16" style={{
        color: tokens.colors.textSecondary,
        maxWidth: '50ch',
        margin: '0 auto 64px',
        lineHeight: 1.6,
      }}>Click any component to learn how data flows from your Angular app through agent to LangGraph and back.</p>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        {/* Left: vertical node stack */}
        <div className="lg:col-span-3 flex flex-col gap-3">
          {NODES.map((node, i) => {
            const style = sideStyle[node.side];
            const isActive = activeNode === node.id;
            // Show edge label between nodes
            const edge = i < NODES.length - 1 ? EDGES[i] : null;

            return (
              <div key={node.id}>
                {/* Node card */}
                <motion.button
                  onClick={() => setActiveNode(isActive ? null : node.id)}
                  className="w-full text-left rounded-xl p-5 transition-all cursor-pointer"
                  style={{
                    background: style.bg,
                    backdropFilter: `blur(${tokens.glass.blur})`,
                    WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
                    border: `1.5px solid ${isActive ? style.activeBorder : style.border}`,
                    boxShadow: isActive ? style.glow : 'none',
                  }}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.4 }}
                  whileHover={{ boxShadow: style.glow }}>
                  <div className="flex items-center gap-3">
                    <span style={{ fontSize: '1.25rem' }}>{node.icon}</span>
                    <div>
                      <div style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: tokens.colors.textPrimary,
                      }}>{node.label}</div>
                      <div style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.7rem',
                        color: tokens.colors.textMuted,
                        marginTop: 2,
                      }}>{node.subtitle}</div>
                    </div>
                  </div>
                </motion.button>

                {/* Edge connector between nodes */}
                {edge && (
                  <div className="flex items-center gap-2 py-1.5 pl-8">
                    <div style={{
                      width: 1,
                      height: 20,
                      background: `linear-gradient(to bottom, ${sideStyle[NODES[i].side].dotColor}40, ${sideStyle[NODES[i + 1].side].dotColor}40)`,
                    }} />
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.65rem',
                      color: tokens.colors.textMuted,
                      letterSpacing: '0.03em',
                    }}>{edge.label}</span>
                    {/* Animated dot */}
                    <motion.div
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        background: sideStyle[NODES[i].side].dotColor,
                      }}
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right: detail panel */}
        <div className="lg:col-span-2 lg:sticky lg:top-24">
          <AnimatePresence mode="wait">
            {active ? (
              <motion.div
                key={active.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="rounded-xl p-6"
                style={{
                  background: tokens.glass.bg,
                  backdropFilter: `blur(${tokens.glass.blur})`,
                  WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
                  border: `1px solid ${sideStyle[active.side].activeBorder}`,
                  boxShadow: sideStyle[active.side].glow,
                }}>
                <div className="flex items-center gap-3 mb-4">
                  <span style={{ fontSize: '1.5rem' }}>{active.icon}</span>
                  <div>
                    <h3 style={{
                      fontFamily: 'var(--font-garamond)',
                      fontWeight: 700,
                      fontSize: '1.25rem',
                      color: tokens.colors.textPrimary,
                    }}>{active.label}</h3>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.7rem',
                      color: tokens.colors.textMuted,
                    }}>{active.subtitle}</span>
                  </div>
                </div>
                <p style={{
                  fontSize: '0.9rem',
                  color: tokens.colors.textSecondary,
                  lineHeight: 1.7,
                }}>{active.description}</p>
              </motion.div>
            ) : (
              <motion.div
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-xl p-6 text-center"
                style={{
                  background: tokens.glass.bg,
                  backdropFilter: `blur(${tokens.glass.blur})`,
                  WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
                  border: `1px solid ${tokens.glass.border}`,
                }}>
                <p style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem',
                  color: tokens.colors.textMuted,
                }}>Click a component to see details</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
