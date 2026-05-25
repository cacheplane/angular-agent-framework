// SPDX-License-Identifier: MIT
import React from 'react';
import { tokens } from '@threadplane/design-tokens';

interface Row {
  label: string;
  versions: string;
  tone: 'success' | 'warn' | 'info' | 'muted';
}

const ROWS: ReadonlyArray<Row> = [
  { label: 'Supported',    versions: 'Angular 20, 21', tone: 'success' },
  { label: 'Experimental', versions: '—',              tone: 'warn'    },
  { label: 'Planned',      versions: 'Angular 22',     tone: 'info'    },
  { label: 'Unsupported',  versions: 'Angular ≤19',    tone: 'muted'   },
];

const TONE_COLORS: Record<Row['tone'], string> = {
  success: '#16a34a',
  warn:    '#d97706',
  info:    tokens.colors.accent,
  muted:   tokens.colors.textMuted,
};

export function CompatibilityMatrix() {
  return (
    <div
      style={{
        border: `1px solid ${tokens.surfaces.border}`,
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: tokens.surfaces.surface }}>
            <th
              style={{
                textAlign: 'left',
                padding: '12px 16px',
                fontWeight: 600,
                color: tokens.colors.textPrimary,
                fontSize: tokens.typography.body.size,
                borderBottom: `1px solid ${tokens.surfaces.border}`,
              }}
            >
              Status
            </th>
            <th
              style={{
                textAlign: 'left',
                padding: '12px 16px',
                fontWeight: 600,
                color: tokens.colors.textPrimary,
                fontSize: tokens.typography.body.size,
                borderBottom: `1px solid ${tokens.surfaces.border}`,
              }}
            >
              Angular versions
            </th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.label}>
              <td
                style={{
                  padding: '12px 16px',
                  fontSize: tokens.typography.body.size,
                  color: TONE_COLORS[row.tone],
                  fontWeight: 500,
                  borderBottom: `1px solid ${tokens.surfaces.border}`,
                }}
              >
                {row.label}
              </td>
              <td
                style={{
                  padding: '12px 16px',
                  fontSize: tokens.typography.body.size,
                  color: tokens.colors.textSecondary,
                  fontFamily: tokens.typography.fontMono,
                  borderBottom: `1px solid ${tokens.surfaces.border}`,
                }}
              >
                {row.versions}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
