// SPDX-License-Identifier: MIT
interface DiagramPillProps {
  /** Center of the pill. */
  cx: number;
  cy: number;
  w: number;
  label: string;
  /** 'accent' (default) for a payoff-adjacent pill; 'neutral' for an event
   * label that should not compete with the card's one accented node. The
   * default preserves the older docs diagrams, but NEW compositions should
   * pass 'neutral' — pills label events/gates, and an accent pill competes
   * with the payoff node. */
  tone?: 'accent' | 'neutral';
}

const PILL_H = 24;

export function DiagramPill({ cx, cy, w, label, tone = 'accent' }: DiagramPillProps) {
  return (
    <g className="tp-diagram-pill" data-tone={tone}>
      <rect x={cx - w / 2} y={cy - PILL_H / 2} width={w} height={PILL_H} rx={PILL_H / 2} />
      <text x={cx} y={cy + 3.5} textAnchor="middle">
        {label}
      </text>
    </g>
  );
}
