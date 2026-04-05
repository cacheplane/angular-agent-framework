/**
 * Glow and shadow tokens for interactive elements.
 */
export const glow = {
  /** Large hero element glow */
  hero: '0 0 60px rgba(0, 64, 144, 0.15)',
  /** Demo/iframe container glow */
  demo: '0 0 30px rgba(0, 64, 144, 0.1)',
  /** Card hover glow */
  card: '0 0 24px rgba(0, 64, 144, 0.1)',
  /** Subtle border glow */
  border: '0 0 12px rgba(0, 64, 144, 0.08)',
  /** CTA button hover glow */
  button: '0 0 16px rgba(0, 64, 144, 0.15)',
} as const;

export type Glow = typeof glow;
