// SPDX-License-Identifier: MIT
import { brand } from '../brand';
import type { CardInput } from '../types';

interface CardShellProps {
  input: CardInput;
  planeDataUri: string;
  headlineSize: number;
  padding: string;
}

interface PillProps {
  tone: 'accent' | 'neutral' | 'angular';
  children: string;
}

function PillBadge({ tone, children }: PillProps) {
  const styles = {
    accent: { bg: 'rgba(0, 64, 144, 0.08)', border: 'rgba(0, 64, 144, 0.18)', color: brand.accent },
    neutral: { bg: '#ffffff', border: '#e6e8ee', color: brand.inkSoft },
    angular: { bg: 'rgba(221, 0, 49, 0.06)', border: 'rgba(221, 0, 49, 0.18)', color: brand.angular },
  }[tone];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px 18px',
        borderRadius: 999,
        background: styles.bg,
        border: `1px solid ${styles.border}`,
        color: styles.color,
        fontFamily: brand.sans,
        fontSize: 15,
        fontWeight: 600,
      }}
    >
      {children}
    </div>
  );
}

export function CardShell({ input, planeDataUri, headlineSize, padding }: CardShellProps) {
  const eyebrow = input.eyebrow ?? brand.defaultEyebrow;
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: brand.gradient,
        display: 'flex',
        flexDirection: 'column',
        padding,
        color: brand.ink,
        fontFamily: brand.sans,
      }}
    >
      {/* Eyebrow */}
      <div
        style={{
          fontFamily: brand.sans,
          fontSize: 18,
          letterSpacing: '0.12em',
          color: brand.accent,
          fontWeight: 600,
          textTransform: 'uppercase',
          marginBottom: 28,
        }}
      >
        {eyebrow}
      </div>

      {/* Headline */}
      <div
        style={{
          fontFamily: brand.serif,
          fontSize: headlineSize,
          lineHeight: 1.05,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: brand.ink,
          marginBottom: 24,
          maxWidth: 980,
        }}
      >
        {input.title}
      </div>

      {/* Subtitle */}
      {input.subtitle ? (
        <div
          style={{
            fontSize: 26,
            lineHeight: 1.45,
            color: brand.inkSoft,
            maxWidth: 920,
            marginBottom: 'auto',
          }}
        >
          {input.subtitle}
        </div>
      ) : (
        <div style={{ marginBottom: 'auto' }} />
      )}

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 36,
        }}
      >
        {input.author ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 22 }}>
            <span style={{ fontWeight: 600, color: brand.ink }}>{input.author.name}</span>
            {input.author.role ? (
              <span style={{ color: brand.inkSoft }}>{`· ${input.author.role}`}</span>
            ) : null}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 12 }}>
            <PillBadge tone="accent">MIT</PillBadge>
            <PillBadge tone="neutral">LangGraph + AG-UI</PillBadge>
            <PillBadge tone="angular">Angular 20+</PillBadge>
          </div>
        )}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontFamily: brand.serif,
            fontSize: 22,
            fontWeight: 700,
            color: brand.ink,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={planeDataUri} width={34} height={34} alt="" />
          <span>{brand.wordmark}</span>
        </div>
      </div>
    </div>
  );
}
