import { tokens } from '@cacheplane/design-tokens';

interface ApiParam {
  name: string;
  type: string;
  description: string;
  optional?: boolean;
}

interface ApiMethod {
  name: string;
  signature: string;
  description: string;
  params?: ApiParam[];
}

export interface ApiDocEntry {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'type';
  description: string;
  signature?: string;
  params?: ApiParam[];
  returns?: { type: string; description: string };
  examples?: string[];
  properties?: ApiParam[];
  methods?: ApiMethod[];
}

function KindBadge({ kind }: { kind: string }) {
  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: '0.65rem',
      padding: '2px 8px',
      borderRadius: 4,
      background: tokens.colors.accentSurface,
      color: tokens.colors.accent,
      textTransform: 'uppercase',
    }}>{kind}</span>
  );
}

function ParamTable({ params }: { params: ApiParam[] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', marginTop: 8 }}>
      <thead>
        <tr style={{ borderBottom: `1px solid ${tokens.colors.accentBorder}` }}>
          {['Parameter', 'Type', 'Description'].map((h) => (
            <th key={h} style={{ textAlign: 'left', padding: '6px 0', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: tokens.colors.textMuted, textTransform: 'uppercase' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {params.map((p) => (
          <tr key={p.name} style={{ borderBottom: `1px solid ${tokens.colors.accentBorder}` }}>
            <td style={{ padding: '6px 0', fontFamily: 'var(--font-mono)', color: tokens.colors.accent }}>{p.name}{p.optional ? '?' : ''}</td>
            <td style={{ padding: '6px 0', fontFamily: 'var(--font-mono)', color: tokens.colors.textSecondary, fontSize: '0.75rem' }}>{p.type}</td>
            <td style={{ padding: '6px 0', color: tokens.colors.textSecondary }}>{p.description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ApiDocRenderer({ entry }: { entry: ApiDocEntry }) {
  return (
    <div style={{
      padding: 24,
      borderRadius: 12,
      border: `1px solid ${tokens.glass.border}`,
      background: tokens.glass.bg,
      backdropFilter: `blur(${tokens.glass.blur})`,
      WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
      boxShadow: tokens.glass.shadow,
      marginBottom: 24,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
        <code style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1.1rem', color: tokens.colors.accent }}>{entry.name}</code>
        <KindBadge kind={entry.kind} />
      </div>

      <p style={{ fontSize: '0.9rem', color: tokens.colors.textSecondary, lineHeight: 1.6, marginBottom: 16 }}>{entry.description}</p>

      {entry.signature && (
        <div style={{ borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
          <pre style={{ padding: 16, background: '#1a1b26', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#a9b1d6', overflowX: 'auto', margin: 0 }}>
            {entry.signature}
          </pre>
        </div>
      )}

      {entry.params && entry.params.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: tokens.colors.textPrimary, marginBottom: 4 }}>Parameters</h4>
          <ParamTable params={entry.params} />
        </div>
      )}

      {entry.returns && (
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: tokens.colors.textPrimary, marginBottom: 4 }}>Returns</h4>
          <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: tokens.colors.accent }}>{entry.returns.type}</code>
        </div>
      )}

      {entry.properties && entry.properties.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: tokens.colors.textPrimary, marginBottom: 4 }}>Properties</h4>
          <ParamTable params={entry.properties} />
        </div>
      )}

      {entry.methods && entry.methods.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: tokens.colors.textPrimary, marginBottom: 4 }}>Methods</h4>
          {entry.methods.map((m) => (
            <div key={m.name} style={{ marginBottom: 12, paddingLeft: 12, borderLeft: `2px solid ${tokens.colors.accentBorder}` }}>
              <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: tokens.colors.accent }}>{m.signature}</code>
              {m.description && <p style={{ fontSize: '0.8rem', color: tokens.colors.textSecondary, marginTop: 4 }}>{m.description}</p>}
              {m.params && m.params.length > 0 && <ParamTable params={m.params} />}
            </div>
          ))}
        </div>
      )}

      {entry.examples && entry.examples.length > 0 && (
        <div>
          <h4 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: tokens.colors.textPrimary, marginBottom: 4 }}>Examples</h4>
          {entry.examples.map((ex, i) => (
            <div key={i} style={{ borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
              <pre style={{ padding: 16, background: '#1a1b26', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#a9b1d6', overflowX: 'auto', margin: 0 }}>
                {ex.replace(/^```\w*\n?/, '').replace(/\n?```$/, '')}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
