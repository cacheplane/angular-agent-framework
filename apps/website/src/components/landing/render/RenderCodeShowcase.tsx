import { tokens } from '@ngaf/design-tokens';
import { HighlightedCode } from '../HighlightedCode';

const SNIPPET_1 = `import { defineAngularRegistry } from '@ngaf/render';
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

const SNIPPETS = [
  { title: 'Registry Setup', code: SNIPPET_1, lang: 'typescript' },
  { title: 'Template Binding', code: SNIPPET_2, lang: 'html' },
];

export async function RenderCodeShowcase() {
  return (
    <section className="render-code" style={{ padding: '80px 32px' }}>
      <style>{`@media (max-width: 767px) { .render-code { padding: 60px 20px !important; } }`}</style>
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
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
      </div>

      <div style={{
        maxWidth: 900, margin: '0 auto',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(380px, 100%), 1fr))', gap: 24,
      }}>
        {SNIPPETS.map((s) => (
          <div
            key={s.title}
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
            <HighlightedCode code={s.code} lang={s.lang} />
          </div>
        ))}
      </div>
    </section>
  );
}
