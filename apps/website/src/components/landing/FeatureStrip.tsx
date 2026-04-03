'use client';
import { motion } from 'framer-motion';
import { Card, CardContent, CardTitle } from '@/components/ui/card';

const FEATURES = [
  { icon: '⚡', title: 'Token-by-token streaming', desc: 'Real-time SSE streaming via FetchStreamTransport. Messages update as each token arrives.' },
  { icon: '🔗', title: 'Thread persistence', desc: 'MemorySaver-backed threads survive page refreshes via threadId signal and onThreadId callback.' },
  { icon: '📐', title: 'Angular Signals', desc: 'Every state slice is an Angular Signal. Works with OnPush, async pipe, and computed().' },
  { icon: '🧪', title: 'MockStreamTransport', desc: 'Deterministic unit testing. Script event sequences and step through them in your specs.' },
  { icon: '🔧', title: 'Full useStream() parity', desc: 'Interrupts, tool calls, subagents, branch history, joinStream — everything the React SDK exposes.' },
  { icon: '🏢', title: 'Source-available licensing', desc: 'Free for noncommercial use under PolyForm Noncommercial 1.0.0. Commercial license at $500/seat/year or $2,000/app deployment.' },
];

export function FeatureStrip() {
  return (
    <section className="px-8 py-16 max-w-6xl mx-auto">
      <h2
        className="font-mono text-xs uppercase tracking-widest mb-12 text-center"
        style={{ color: 'var(--color-accent)', fontWeight: 'normal' }}
      >
        Features
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08, duration: 0.4 }}
            whileHover={{
              borderColor: 'rgba(108,142,255,0.4)',
              boxShadow: '0 0 12px rgba(108,142,255,0.2)',
            }}
          >
            <Card className="p-6 h-full cursor-default transition-all">
              <div className="mb-3 text-2xl" style={{ color: '#6C8EFF' }} aria-hidden="true">
                {f.icon}
              </div>
              <CardTitle className="mb-2">{f.title}</CardTitle>
              <CardContent className="p-0">
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
