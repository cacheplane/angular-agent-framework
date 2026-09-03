interface DiagramNodeProps {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  eyebrow?: string;
  meta?: string;
  /** 'accent' has two conventions: concept/marketing compositions accent the single
   * PAYOFF node (what the customer gets); StackDiagram uses it as a subject
   * highlight ("the node this page is about"). 'dim' marks inputs/externals. */
  tone?: 'neutral' | 'accent' | 'dim';
  /** 'middle' centers text horizontally (title-only summary nodes). */
  align?: 'start' | 'middle';
  /** 'sans' for prose-y titles (backend lists); default mono for package names. */
  titleStyle?: 'mono' | 'sans';
  /** 'mono' for code-shaped meta lines (JSON fragments, API names); default Inter. */
  metaStyle?: 'sans' | 'mono';
}

const PAD = 16;

/**
 * SVG text neither wraps nor clips — the caller owns fitting text to `w`.
 * Minimum heights: `h >= 64` with eyebrow+meta, `h >= 52` with meta only,
 * `h >= 52` with eyebrow and no meta (eyebrow at y+20, title at y+38),
 * any `h` for title-only (vertically centered).
 *
 * Compact-scale compositions author at a ~320 viewBox with the compact type
 * ramp (eyebrow 10 / mono title 13.5 / sans title 12 / meta 11 / pill 10.5,
 * viewBox units); the same baseline offsets above apply unchanged.
 */
export function DiagramNode({
  x,
  y,
  w,
  h,
  title,
  eyebrow,
  meta,
  tone = 'neutral',
  align = 'start',
  titleStyle = 'mono',
  metaStyle = 'sans',
}: DiagramNodeProps) {
  const tx = align === 'middle' ? x + w / 2 : x + PAD;
  const anchor = align === 'middle' ? 'middle' : undefined;
  // Baselines: with an eyebrow the stack is eyebrow/title/meta; without it the
  // title floats up; a title-only node vertically centers.
  const titleY = eyebrow ? y + 38 : meta ? y + 26 : y + h / 2 + 4;
  const metaY = eyebrow ? y + 54 : y + 42;
  return (
    <g className="tp-diagram-node" data-tone={tone} data-title={titleStyle} data-meta={metaStyle}>
      <rect x={x} y={y} width={w} height={h} rx="10" />
      {eyebrow ? (
        <text className="tp-diagram-eyebrow" x={tx} y={y + 20} textAnchor={anchor}>
          {eyebrow.toUpperCase()}
        </text>
      ) : null}
      <text className="tp-diagram-title" x={tx} y={titleY} textAnchor={anchor}>
        {title}
      </text>
      {meta ? (
        <text className="tp-diagram-meta" x={tx} y={metaY} textAnchor={anchor}>
          {meta}
        </text>
      ) : null}
    </g>
  );
}
