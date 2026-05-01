'use client';
import Link from 'next/link';
import { tokens } from '@ngaf/design-tokens';

export function CardGroup({ cols = 2, children }: { cols?: number; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${100 / cols - 2}%), 1fr))`,
      gap: 14,
      marginTop: 16,
      marginBottom: 20,
    }}>
      {children}
    </div>
  );
}

export function Card({ title, href, icon, children }: { title: string; href: string; icon?: string; children: React.ReactNode }) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div
        style={{
          padding: 18,
          borderRadius: 12,
          border: `1px solid ${tokens.glass.border}`,
          background: tokens.glass.bg,
          backdropFilter: `blur(${tokens.glass.blur})`,
          WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
          transition: 'box-shadow 0.2s, border-color 0.2s, transform 0.2s',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = tokens.glow.card;
          e.currentTarget.style.borderColor = tokens.colors.accentBorderHover;
          e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = 'none';
          e.currentTarget.style.borderColor = tokens.glass.border;
          e.currentTarget.style.transform = 'translateY(0)';
        }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            {icon && <div style={{ fontSize: '1.15rem', marginBottom: 6 }}>{icon}</div>}
            <div style={{
              fontFamily: 'var(--font-garamond)',
              fontWeight: 700,
              fontSize: '0.95rem',
              color: tokens.colors.textPrimary,
              marginBottom: 4,
            }}>{title}</div>
          </div>
          <span style={{ color: tokens.colors.textMuted, fontSize: '0.9rem', marginTop: 2 }}>→</span>
        </div>
        <div style={{ fontSize: '0.8rem', color: tokens.colors.textSecondary, lineHeight: 1.5 }}>
          {children}
        </div>
      </div>
    </Link>
  );
}
