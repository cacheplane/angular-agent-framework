/**
 * Typography tokens — font families used across the design system.
 *
 * - Serif (EB Garamond): Headlines, elegant emphasis
 * - Sans (Inter): Body text, UI elements
 * - Mono (JetBrains Mono): Code, labels, metadata
 */
export const typography = {
  /** Serif font for headings */
  fontSerif: '"EB Garamond", Georgia, serif',
  /** Sans-serif font for body text */
  fontSans: 'Inter, system-ui, sans-serif',
  /** Monospace font for code and labels */
  fontMono: '"JetBrains Mono", monospace',
} as const;

export type Typography = typeof typography;
