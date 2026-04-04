import Link from 'next/link';
import { tokens } from '../../../../lib/design-tokens';

export function CardGroup({ cols = 2, children }: { cols?: number; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap: 12,
      marginBottom: 16,
    }}>
      {children}
    </div>
  );
}

export function Card({ title, href, icon, children }: { title: string; href: string; icon?: string; children: React.ReactNode }) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div style={{
        padding: 16,
        borderRadius: 10,
        border: `1px solid ${tokens.glass.border}`,
        background: tokens.glass.bg,
        backdropFilter: `blur(${tokens.glass.blur})`,
        WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
        transition: 'box-shadow 0.2s, border-color 0.2s',
        cursor: 'pointer',
      }}>
        {icon && <div style={{ fontSize: '1.25rem', marginBottom: 6 }}>{icon}</div>}
        <div style={{
          fontFamily: 'var(--font-garamond)',
          fontWeight: 700,
          fontSize: '1rem',
          color: tokens.colors.textPrimary,
          marginBottom: 4,
        }}>{title}</div>
        <div style={{ fontSize: '0.8rem', color: tokens.colors.textSecondary, lineHeight: 1.5 }}>
          {children}
        </div>
      </div>
    </Link>
  );
}
