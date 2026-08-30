// SPDX-License-Identifier: MIT
import React from 'react';

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

export function CompatibilityMatrix() {
  return (
    <div className="compat-matrix">
      <table className="compat-matrix-table">
        <thead>
          <tr className="compat-matrix-head-row">
            <th scope="col" className="compat-matrix-th">
              Status
            </th>
            <th scope="col" className="compat-matrix-th">
              Angular versions
            </th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.label}>
              <th scope="row" className="compat-matrix-td-label" data-tone={row.tone}>
                {row.label}
              </th>
              <td className="compat-matrix-td-versions">
                {row.versions}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
