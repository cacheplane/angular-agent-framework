'use client';
import Link from 'next/link';
import { tokens } from '../../../../lib/design-tokens';

interface ChipData {
  icon: string;
  title: string;
  signal: string;
  href: string;
  gradient: string;
  border: string;
}

const CHIPS: ChipData[] = [
  { icon: '⚡', title: 'Messages', signal: 'chat.messages()', href: '/docs/guides/streaming', gradient: 'linear-gradient(135deg, rgba(0,64,144,0.06), rgba(100,195,253,0.08))', border: 'rgba(0,64,144,0.1)' },
  { icon: '📡', title: 'Status', signal: 'chat.status()', href: '/docs/guides/streaming', gradient: 'linear-gradient(135deg, rgba(100,80,200,0.06), rgba(140,120,220,0.08))', border: 'rgba(100,80,200,0.1)' },
  { icon: '💾', title: 'Persistence', signal: 'threadId', href: '/docs/guides/persistence', gradient: 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(52,199,89,0.08))', border: 'rgba(16,185,129,0.1)' },
  { icon: '✋', title: 'Interrupts', signal: 'chat.interrupt()', href: '/docs/guides/interrupts', gradient: 'linear-gradient(135deg, rgba(232,147,12,0.06), rgba(245,180,60,0.08))', border: 'rgba(232,147,12,0.1)' },
  { icon: '⏪', title: 'Time Travel', signal: 'chat.history()', href: '/docs/guides/time-travel', gradient: 'linear-gradient(135deg, rgba(221,0,49,0.05), rgba(255,100,130,0.07))', border: 'rgba(221,0,49,0.08)' },
  { icon: '🔀', title: 'Subagents', signal: 'Phase 2', href: '/docs/guides/subgraphs', gradient: 'linear-gradient(135deg, rgba(0,64,144,0.05), rgba(0,100,180,0.07))', border: 'rgba(0,64,144,0.08)' },
  { icon: '🔧', title: 'Tool Calls', signal: 'chat.toolCalls()', href: '/docs/guides/streaming', gradient: 'linear-gradient(135deg, rgba(100,80,200,0.05), rgba(120,100,210,0.07))', border: 'rgba(100,80,200,0.08)' },
  { icon: '🧪', title: 'Testing', signal: 'MockTransport', href: '/docs/guides/testing', gradient: 'linear-gradient(135deg, rgba(16,185,129,0.05), rgba(40,200,140,0.07))', border: 'rgba(16,185,129,0.08)' },
];

export function FeatureChips() {
  return (
    <div style={{
      display: 'flex',
      gap: 10,
      overflowX: 'auto',
      paddingBottom: 8,
      marginTop: 20,
      marginBottom: 28,
      scrollbarWidth: 'thin',
      scrollbarColor: `${tokens.colors.accentBorder} transparent`,
    }}>
      {CHIPS.map((chip) => (
        <Link key={chip.title} href={chip.href} style={{ textDecoration: 'none', flexShrink: 0 }}>
          <div
            style={{
              width: 130,
              padding: '16px 14px',
              borderRadius: 14,
              background: chip.gradient,
              backdropFilter: `blur(${tokens.glass.blur})`,
              WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
              border: `1px solid ${chip.border}`,
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>{chip.icon}</div>
            <div style={{
              fontSize: 13,
              fontWeight: 600,
              color: tokens.colors.textPrimary,
              marginBottom: 4,
            }}>{chip.title}</div>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: tokens.colors.accent,
              opacity: 0.8,
            }}>{chip.signal}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}
