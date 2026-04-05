import { tokens } from '@cacheplane/design-tokens';

export interface ApiEntry {
  name: string;
  type: string;
  description: string;
  params?: { name: string; type: string; desc: string }[];
}

export function ApiRefTable({ entries }: { entries: ApiEntry[] }) {
  return (
    <div className="flex flex-col gap-8">
      {entries.map((entry) => (
        <div
          key={entry.name}
          className="p-6 rounded-lg"
          style={{
            border: `1px solid ${tokens.glass.border}`,
            background: tokens.glass.bg,
            backdropFilter: `blur(${tokens.glass.blur})`,
            WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
            boxShadow: tokens.glass.shadow,
          }}>
          <div className="flex items-baseline gap-3 mb-2">
            <code
              className="font-mono font-bold text-base"
              style={{ color: tokens.colors.accent }}>
              {entry.name}
            </code>
            <code
              className="font-mono text-xs"
              style={{ color: tokens.colors.textSecondary }}>
              {entry.type}
            </code>
          </div>
          <p className="text-sm mb-4" style={{ color: tokens.colors.textSecondary }}>{entry.description}</p>
          {entry.params && entry.params.length > 0 && (
            <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${tokens.colors.accentBorder}` }}>
                  {['Parameter', 'Type', 'Description'].map((h) => (
                    <th
                      key={h}
                      className="text-left py-2 font-mono uppercase"
                      style={{ color: tokens.colors.textMuted }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entry.params.map((p) => (
                  <tr key={p.name} style={{ borderBottom: `1px solid ${tokens.colors.accentBorder}` }}>
                    <td className="py-2 font-mono" style={{ color: tokens.colors.accent }}>{p.name}</td>
                    <td className="py-2 font-mono" style={{ color: tokens.colors.textSecondary }}>{p.type}</td>
                    <td className="py-2" style={{ color: tokens.colors.textSecondary }}>{p.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}
