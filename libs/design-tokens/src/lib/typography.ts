/**
 * Typography tokens — font families and type scale used across the design system.
 *
 * - Serif (EB Garamond): Headlines, elegant emphasis
 * - Sans (Inter): Body text, UI elements
 * - Mono (JetBrains Mono): Code, labels, metadata
 *
 * The h1/h2/h3/eyebrow/bodyLg/body/caption objects are the type scale
 * used by the marketing-site UI primitives. Each entry includes
 * `size`, `line`, `family`, and (where relevant) `weight`,
 * `letterSpacing`, `transform`.
 */
export const typography = {
  /** Serif font for headings */
  fontSerif: '"EB Garamond", Georgia, serif',
  /** Sans-serif font for body text */
  fontSans: 'Inter, system-ui, sans-serif',
  /** Monospace font for code and labels */
  fontMono: '"JetBrains Mono", monospace',

  h1: {
    size: 'clamp(48px, 6vw, 72px)',
    line: 1.08,
    family: 'var(--font-garamond)',
  },
  h2: {
    size: 'clamp(36px, 4.5vw, 56px)',
    line: 1.12,
    family: 'var(--font-garamond)',
  },
  h3: {
    size: '28px',
    line: 1.25,
    family: 'var(--font-inter)',
    weight: 600,
  },
  eyebrow: {
    size: '12px',
    line: 1.4,
    family: 'var(--font-mono)',
    weight: 700,
    letterSpacing: '0.12em',
    transform: 'uppercase' as const,
  },
  bodyLg: {
    size: '20px',
    line: 1.6,
    family: 'var(--font-inter)',
  },
  body: {
    size: '16px',
    line: 1.6,
    family: 'var(--font-inter)',
  },
  caption: {
    size: '14px',
    line: 1.5,
    family: 'var(--font-inter)',
  },
} as const;

export type Typography = typeof typography;
