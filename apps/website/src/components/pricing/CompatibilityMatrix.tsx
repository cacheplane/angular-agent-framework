// SPDX-License-Identifier: MIT
import React from 'react';
import { WEBSITE_ANGULAR_SUPPORT_ROWS } from './angular-support.mjs';

interface Row {
  readonly label: string;
  readonly versions: string;
  readonly tone: 'success' | 'warn' | 'info' | 'muted';
}

const ROWS: readonly Row[] = WEBSITE_ANGULAR_SUPPORT_ROWS;

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
              <th
                scope="row"
                className="compat-matrix-td-label"
                data-tone={row.tone}
              >
                {row.label}
              </th>
              <td className="compat-matrix-td-versions">{row.versions}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
