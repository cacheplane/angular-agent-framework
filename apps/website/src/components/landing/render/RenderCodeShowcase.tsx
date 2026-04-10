// apps/website/src/components/landing/render/RenderCodeShowcase.tsx
'use client';
import { motion } from 'framer-motion';
import { tokens } from '@cacheplane/design-tokens';

const SNIPPET_1 = `import { defineAngularRegistry } from '@cacheplane/render';
import { TableComponent } from './table.component';
import { ChartComponent } from './chart.component';

const registry = defineAngularRegistry({
  table: TableComponent,
  chart: ChartComponent,
  form: FormComponent,
});`;

const SNIPPET_2 = `<render-spec
  [spec]="agentOutput()"
  [registry]="registry"
  [state]="stateStore"
/>`;

export function RenderCodeShowcase() {
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
          Developer Experience
        </p>
        <h2 style={{
          fontFamily: 'var(--font-garamond,"EB Garamond",Georgia,serif)',
          fontSize: 'clamp(26px,3.5vw,42px)', fontWeight: 800, lineHeight: 1.1,
          color: tokens.colors.textPrimary,
        }}>
          Generative UI in a few lines
        </h2>
      </motion.div>

      <div style={{
        maxWidth: 900, margin: '0 auto',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 24,
      }}>
        {[{ title: 'Registry Setup', code: SNIPPET_1 }, { title: 'Template Binding', code: SNIPPET_2 }].map((s, i) => (
          <motion.div
            key={s.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: i * 0.1 }}
            style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${tokens.glass.border}` }}
          >
            <div style={{
              padding: '10px 20px', background: 'rgba(26,122,64,0.04)',
              borderBottom: `1px solid ${tokens.glass.border}`,
            }}>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: '0.68rem',
                fontWeight: 700, color: tokens.colors.renderGreen,
              }}>
                {s.title}
              </span>
            </div>
            <pre style={{
              background: '#1a1b26', color: '#c8ccee', padding: '20px 24px',
              fontSize: '0.78rem', lineHeight: 1.65, margin: 0, overflowX: 'auto',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              <code>{s.code}</code>
            </pre>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
