interface DiagramEdgeProps {
  /** SVG path data; orthogonal segments (H/V) preferred. */
  d: string;
  /** DiagramFrame slug — required when arrow is true, to reference `{slug}-arrow`. */
  slug?: string;
  arrow?: boolean;
}

export function DiagramEdge({ d, slug, arrow = false }: DiagramEdgeProps) {
  return (
    <path
      className="tp-diagram-edge"
      d={d}
      markerEnd={arrow && slug ? `url(#${slug}-arrow)` : undefined}
    />
  );
}
