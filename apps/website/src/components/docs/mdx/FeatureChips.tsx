'use client';
import Link from 'next/link';
import { tokens } from '@threadplane/design-tokens';

interface ChipData {
  icon: string;
  title: string;
  signal: string;
  href: string;
}

const CHIPS: ChipData[] = [
  { icon: '⚡', title: 'Messages', signal: 'chat.messages()', href: '/docs/agent/guides/streaming' },
  { icon: '📡', title: 'Status', signal: 'chat.status()', href: '/docs/agent/guides/streaming' },
  { icon: '💾', title: 'Persistence', signal: 'threadId', href: '/docs/agent/guides/persistence' },
  { icon: '✋', title: 'Interrupts', signal: 'chat.interrupt()', href: '/docs/agent/guides/interrupts' },
  { icon: '⏪', title: 'Time Travel', signal: 'chat.history()', href: '/docs/agent/guides/time-travel' },
  { icon: '🔀', title: 'Subagents', signal: 'chat.subagents()', href: '/docs/agent/guides/subgraphs' },
  { icon: '🔧', title: 'Tool Calls', signal: 'chat.toolCalls()', href: '/docs/agent/guides/streaming' },
  { icon: '🧪', title: 'Testing', signal: 'MockTransport', href: '/docs/agent/guides/testing' },
];

export function FeatureChips() {
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        overflowX: 'auto',
        paddingBottom: 8,
        marginTop: 20,
        marginBottom: 28,
        scrollbarWidth: 'thin',
        scrollbarColor: `${tokens.surfaces.borderStrong} transparent`,
      }}
    >
      {CHIPS.map((chip) => (
        <Link key={chip.title} href={chip.href} style={{ textDecoration: 'none', flexShrink: 0 }}>
          <div
            data-mdx="feature-chip"
            style={{
              width: 130,
              padding: '14px 12px',
              borderRadius: tokens.radius.lg,
              background: tokens.surfaces.surface,
              border: `1px solid ${tokens.surfaces.border}`,
              boxShadow: tokens.shadows.sm,
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = tokens.shadows.md;
              e.currentTarget.style.borderColor = tokens.surfaces.borderStrong;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = tokens.shadows.sm;
              e.currentTarget.style.borderColor = tokens.surfaces.border;
            }}
          >
            <div style={{ fontSize: 22, marginBottom: 8 }}>{chip.icon}</div>
            <div
              style={{
                fontFamily: tokens.typography.fontSans,
                fontSize: 13,
                fontWeight: 600,
                color: tokens.colors.textPrimary,
                marginBottom: 4,
              }}
            >
              {chip.title}
            </div>
            <div
              style={{
                fontFamily: tokens.typography.fontMono,
                fontSize: 10,
                color: tokens.colors.accent,
              }}
            >
              {chip.signal}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
