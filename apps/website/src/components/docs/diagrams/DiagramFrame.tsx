import type { ReactNode } from 'react';

interface DiagramFrameProps {
  /** Unique per rendered diagram; namespaces the SVG defs ids (`{slug}-dots`, `{slug}-arrow`). */
  slug: string;
  viewWidth: number;
  viewHeight: number;
  /** Accessible one-sentence description of what the diagram shows. */
  label: string;
  caption?: string;
  /** Marketing pages render the same SVG larger. */
  scale?: 'docs' | 'marketing';
  children: ReactNode;
}

export function DiagramFrame({
  slug,
  viewWidth,
  viewHeight,
  label,
  caption,
  scale = 'docs',
  children,
}: DiagramFrameProps) {
  return (
    <figure className="tp-diagram-figure" data-scale={scale}>
      <svg
        className="tp-diagram-svg"
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
        role="img"
        aria-label={label}
      >
        <defs>
          <pattern id={`${slug}-dots`} width="16" height="16" patternUnits="userSpaceOnUse">
            <circle className="tp-diagram-dot" cx="1" cy="1" r="1" />
          </pattern>
          <marker
            id={`${slug}-arrow`}
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path
              className="tp-diagram-arrowhead"
              d="M1 1 L7 4 L1 7"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </marker>
        </defs>
        <rect width={viewWidth} height={viewHeight} rx="10" fill={`url(#${slug}-dots)`} />
        {children}
      </svg>
      {caption ? <figcaption className="tp-diagram-caption">{caption}</figcaption> : null}
    </figure>
  );
}
