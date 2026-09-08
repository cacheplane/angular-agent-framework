/**
 * Typography tokens — font families and type scale used across the design system.
 *
 * - Display (Archivo Black): headlines and the wordmark. Single weight.
 * - Sans (Archivo): body text, UI elements
 * - Diagram (Inter): diagram text ONLY — see fontDiagram
 * - Mono (JetBrains Mono): code, labels, metadata
 *
 * The h1/h2/h3/eyebrow/bodyLg/body/caption objects are the type scale
 * used by the marketing-site UI primitives. Each entry includes
 * `size`, `line`, `family`, and (where relevant) `weight`,
 * `letterSpacing`, `transform`.
 */
export const typography = {
  /** Display face for headlines. Archivo Black ships one weight (400). */
  fontDisplay: '"Archivo Black", system-ui, sans-serif',
  /** Text and UI face. */
  fontSans: 'Archivo, system-ui, sans-serif',
  /**
   * Diagram text, deliberately NOT the brand face.
   *
   * Diagrams are information, not brand surface, and their geometry is tuned
   * to Inter's metrics: EnterpriseArchitecture.tsx pins every rectangle to an
   * 8px grid and home-architecture.spec.ts measures each rendered text run
   * against its card. Retyping diagrams would force a geometry rework larger
   * than the retheme itself.
   */
  fontDiagram: 'Inter, system-ui, sans-serif',
  /** Monospace font for code and labels. ui-monospace before the generic
   * keyword: consumers that don't load JetBrains Mono (the cockpit example
   * apps) get the platform mono (SF Mono) instead of Courier. */
  fontMono: '"JetBrains Mono", ui-monospace, monospace',

  h1: {
    size: 'clamp(48px, 6vw, 72px)',
    line: 1.08,
    family: 'var(--font-display)',
  },
  h2: {
    size: 'clamp(36px, 4.5vw, 56px)',
    line: 1.12,
    family: 'var(--font-display)',
  },
  h3: {
    size: '28px',
    line: 1.25,
    family: 'var(--font-sans)',
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
    family: 'var(--font-sans)',
  },
  body: {
    size: '16px',
    line: 1.6,
    family: 'var(--font-sans)',
  },
  caption: {
    size: '14px',
    line: 1.5,
    family: 'var(--font-sans)',
  },
} as const;

export type Typography = typeof typography;
