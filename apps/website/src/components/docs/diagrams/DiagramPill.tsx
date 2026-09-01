interface DiagramPillProps {
  /** Center of the pill. */
  cx: number;
  cy: number;
  w: number;
  label: string;
}

const PILL_H = 24;

export function DiagramPill({ cx, cy, w, label }: DiagramPillProps) {
  return (
    <g className="tp-diagram-pill">
      <rect x={cx - w / 2} y={cy - PILL_H / 2} width={w} height={PILL_H} rx={PILL_H / 2} />
      <text x={cx} y={cy + 3.5} textAnchor="middle">
        {label}
      </text>
    </g>
  );
}
