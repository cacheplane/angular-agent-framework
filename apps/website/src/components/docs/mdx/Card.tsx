'use client';
import Link from 'next/link';

export function CardGroup({ cols = 2, children }: { cols?: number; children: React.ReactNode }) {
  return (
    <div
      className="mdx-card-group"
      style={{
        gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${100 / cols - 2}%), 1fr))`,
      }}
    >
      {children}
    </div>
  );
}

export function Card({
  title,
  href,
  icon,
  external = false,
  children,
}: {
  title: string;
  href: string;
  icon?: string;
  /** When true, open in a new tab (for off-site links: demos, GitHub, etc.). */
  external?: boolean;
  children: React.ReactNode;
}) {
  const externalProps = external
    ? { target: '_blank', rel: 'noopener noreferrer' }
    : {};
  return (
    <Link href={href} className="mdx-card-link" {...externalProps}>
      <div data-mdx="card">
        <div className="mdx-card-row">
          <div>
            {icon ? <div className="mdx-card-icon">{icon}</div> : null}
            <div className="mdx-card-title">{title}</div>
          </div>
          <span className="mdx-card-arrow">→</span>
        </div>
        <div className="mdx-card-body">{children}</div>
      </div>
    </Link>
  );
}
