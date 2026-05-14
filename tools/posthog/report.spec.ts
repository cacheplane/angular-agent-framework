import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sparkline, formatDeltaCell, renderReport } from './report.js';

test('sparkline: empty array returns dash', () => {
  assert.equal(sparkline([]), '—');
});

test('sparkline: maps values to 8-bar palette', () => {
  assert.equal(sparkline([0, 1, 2, 4, 8]), '▁▂▃▅█');
});

test('sparkline: all zeros returns flat low bars', () => {
  assert.equal(sparkline([0, 0, 0, 0]), '▁▁▁▁');
});

test('formatDeltaCell: zero last week with positive this week returns "new"', () => {
  const cell = formatDeltaCell({ thisWeek: 5, lastWeek: 0 });
  assert.match(cell, /\+5 \(new\)/);
});

test('formatDeltaCell: standard percent diff', () => {
  const cell = formatDeltaCell({ thisWeek: 120, lastWeek: 100 });
  assert.match(cell, /\+20 \(\+20%\)/);
});

test('formatDeltaCell: negative diff', () => {
  const cell = formatDeltaCell({ thisWeek: 80, lastWeek: 100 });
  assert.match(cell, /-20 \(-20%\)/);
});

test('renderReport: produces stable markdown structure', () => {
  const out = renderReport(
    [{ name: 'GTM · Test', rows: [{ metric: 'X', thisWeek: 10, lastWeek: 5, weeks: [1, 2, 3, 10] }] }],
    '2026-05-14',
  );
  assert.match(out, /^# GTM weekly snapshot — 2026-05-14/);
  assert(out.includes('## GTM · Test'));
  assert(out.includes('## Notes'));
  assert(out.includes('<!-- HUMAN:'));
  assert(out.includes('| X '));
});
