// SPDX-License-Identifier: MIT
type DiagramEdgeProps = {
  /** SVG path data; orthogonal segments (H/V) preferred. Arrowheads point along path direction — reverse `d` for a reversed arrow. */
  d: string;
} & (
  | {
      /** Draw an arrowhead at the path end. */
      arrow: true;
      /** DiagramFrame slug, to reference its `{slug}-arrow` marker. */
      slug: string;
    }
  | { arrow?: false; slug?: string }
);

export function DiagramEdge({ d, slug, arrow = false }: DiagramEdgeProps) {
  return (
    <path
      className="tp-diagram-edge"
      d={d}
      markerEnd={arrow && slug ? `url(#${slug}-arrow)` : undefined}
    />
  );
}
