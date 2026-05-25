'use client';
import Link from 'next/link';
import { tokens } from '@threadplane/design-tokens';

export function CardGroup({ cols = 2, children }: { cols?: number; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${100 / cols - 2}%), 1fr))`,
        gap: 14,
        marginTop: 16,
        marginBottom: 20,
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
  children,
}: {
  title: string;
  href: string;
  icon?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div
        data-mdx="card"
        style={{
          padding: 18,
          borderRadius: tokens.radius.lg,
          border: `1px solid ${tokens.surfaces.border}`,
          background: tokens.surfaces.surface,
          boxShadow: tokens.shadows.sm,
          transition: 'box-shadow 160ms ease, border-color 160ms ease, transform 160ms ease',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = tokens.shadows.md;
          e.currentTarget.style.borderColor = tokens.surfaces.borderStrong;
          e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = tokens.shadows.sm;
          e.currentTarget.style.borderColor = tokens.surfaces.border;
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            {icon ? <div style={{ fontSize: '1.15rem', marginBottom: 6 }}>{icon}</div> : null}
            <div
              style={{
                fontFamily: tokens.typography.fontSerif,
                fontWeight: 700,
                fontSize: '0.95rem',
                color: tokens.colors.textPrimary,
                marginBottom: 4,
              }}
            >
              {title}
            </div>
          </div>
          <span style={{ color: tokens.colors.textMuted, fontSize: '0.9rem', marginTop: 2 }}>→</span>
        </div>
        <div
          style={{
            fontFamily: tokens.typography.body.family,
            fontSize: '0.85rem',
            lineHeight: 1.5,
            color: tokens.colors.textSecondary,
          }}
        >
          {children}
        </div>
      </div>
    </Link>
  );
}
