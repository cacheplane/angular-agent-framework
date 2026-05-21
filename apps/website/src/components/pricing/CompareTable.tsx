'use client';
import { tokens } from '@ngaf/design-tokens';

type TierKey = 'community' | 'indie' | 'seat' | 'app' | 'enterprise';

interface Row {
  feature: string;
  cells: Record<TierKey, boolean | string>;
}

const TIERS: { key: TierKey; label: string }[] = [
  { key: 'community', label: 'Community' },
  { key: 'indie', label: 'Indie' },
  { key: 'seat', label: 'Developer Seat' },
  { key: 'app', label: 'App Deployment' },
  { key: 'enterprise', label: 'Enterprise' },
];

const ROWS: Row[] = [
  {
    feature: 'License model',
    cells: {
      community: 'PolyForm NC 1.0.0',
      indie: 'Commercial',
      seat: 'Commercial',
      app: 'Commercial',
      enterprise: 'Commercial + custom',
    },
  },
  {
    feature: 'Commercial production use',
    cells: { community: false, indie: true, seat: true, app: true, enterprise: true },
  },
  {
    feature: 'Developers',
    cells: { community: 'Unlimited (noncommercial)', indie: '1', seat: 'Per seat', app: 'Unlimited', enterprise: 'Unlimited' },
  },
  {
    feature: 'Apps covered',
    cells: { community: 'Unlimited (noncommercial)', indie: '1', seat: 'All apps owned by your org', app: '1', enterprise: 'Multi-app' },
  },
  {
    feature: 'End users',
    cells: { community: 'Unlimited', indie: 'Unlimited', seat: 'Unlimited', app: 'Unlimited', enterprise: 'Unlimited' },
  },
  {
    feature: 'Environments (dev / staging / prod)',
    cells: { community: false, indie: true, seat: true, app: true, enterprise: true },
  },
  {
    feature: 'Support',
    cells: { community: 'Community', indie: 'Email', seat: 'Email', app: 'Email', enterprise: 'Priority + private channel' },
  },
  {
    feature: 'SLA',
    cells: { community: false, indie: false, seat: false, app: false, enterprise: true },
  },
  {
    feature: 'Security review',
    cells: { community: false, indie: false, seat: false, app: false, enterprise: true },
  },
];

const Check = () => <span style={{ color: tokens.colors.accent }}>✓</span>;
const X = () => <span style={{ color: tokens.colors.textMuted }}>—</span>;

function renderCell(value: boolean | string): React.ReactNode {
  if (typeof value === 'boolean') return value ? <Check /> : <X />;
  return <span style={{ color: tokens.colors.textSecondary, fontSize: 13 }}>{value}</span>;
}

export function CompareTable() {
  return (
    <section className="px-8 py-8 max-w-6xl mx-auto overflow-x-auto">
      <div
        style={{
          background: tokens.surfaces.surface,
          border: `1px solid ${tokens.surfaces.border}`,
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <table className="w-full text-sm" style={{ borderCollapse: 'collapse', minWidth: 760 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${tokens.colors.accentBorder}`, background: 'rgba(255,255,255,0.55)' }}>
              <th
                className="text-left py-3 px-4 font-mono text-xs uppercase"
                style={{ color: tokens.colors.textMuted }}
              >
                Feature
              </th>
              {TIERS.map((t) => (
                <th
                  key={t.key}
                  className="text-center py-3 px-4 font-mono text-xs uppercase"
                  style={{ color: tokens.colors.accent }}
                >
                  {t.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr
                key={row.feature}
                style={{ borderBottom: `1px solid ${tokens.colors.accentBorder}` }}
                onMouseEnter={(e) => (e.currentTarget.style.background = tokens.colors.accentSurface)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <td className="py-3 px-4" style={{ color: tokens.colors.textSecondary }}>
                  {row.feature}
                </td>
                {TIERS.map((t) => (
                  <td key={t.key} className="py-3 px-4 text-center">
                    {renderCell(row.cells[t.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
