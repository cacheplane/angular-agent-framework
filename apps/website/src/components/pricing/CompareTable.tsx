'use client';
import { tokens } from '@ngaf/design-tokens';

const ROWS = [
  { feature: 'npm install', oss: true, seat: true, app: true, enterprise: true },
  { feature: 'Commercial use', oss: false, seat: true, app: true, enterprise: true },
  { feature: 'All Angular versions', oss: true, seat: true, app: true, enterprise: true },
  { feature: 'Email support', oss: false, seat: true, app: true, enterprise: true },
  { feature: 'Source access', oss: true, seat: true, app: true, enterprise: true },
  { feature: 'Per-app deployment', oss: false, seat: false, app: true, enterprise: true },
  { feature: 'Volume licensing', oss: false, seat: false, app: false, enterprise: true },
  { feature: 'Priority support', oss: false, seat: false, app: false, enterprise: true },
];

const Check = () => <span style={{ color: tokens.colors.accent }}>✓</span>;
const X = () => <span style={{ color: tokens.colors.textMuted }}>—</span>;

export function CompareTable() {
  return (
    <section className="px-8 py-8 max-w-6xl mx-auto overflow-x-auto">
      <div style={{
        background: tokens.glass.bg,
        backdropFilter: `blur(${tokens.glass.blur})`,
        WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
        border: `1px solid ${tokens.glass.border}`,
        borderRadius: 12,
        overflow: 'hidden',
      }}>
        <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${tokens.colors.accentBorder}`, background: 'rgba(255,255,255,0.55)' }}>
              <th className="text-left py-3 px-4 font-mono text-xs uppercase" style={{ color: tokens.colors.textMuted }}>Feature</th>
              {['Community', 'Developer Seat', 'App Deployment', 'Enterprise'].map((h) => (
                <th key={h} className="text-center py-3 px-4 font-mono text-xs uppercase" style={{ color: tokens.colors.accent }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr
                key={row.feature}
                style={{ borderBottom: `1px solid ${tokens.colors.accentBorder}` }}
                onMouseEnter={(e) => (e.currentTarget.style.background = tokens.colors.accentSurface)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                <td className="py-3 px-4" style={{ color: tokens.colors.textSecondary }}>{row.feature}</td>
                <td className="py-3 px-4 text-center">{row.oss ? <Check /> : <X />}</td>
                <td className="py-3 px-4 text-center">{row.seat ? <Check /> : <X />}</td>
                <td className="py-3 px-4 text-center">{row.app ? <Check /> : <X />}</td>
                <td className="py-3 px-4 text-center">{row.enterprise ? <Check /> : <X />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
