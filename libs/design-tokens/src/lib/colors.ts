/**
 * Core color palette for the stream-resource design system.
 *
 * Light theme with LangGraph blue accent and Angular red brand color.
 * Used across both the website and cockpit.
 */
export const colors = Object.freeze({
  /** Base background — light cream */
  bg: '#f8f9fc',
  /** Primary accent — LangGraph blue */
  accent: '#004090',
  /** Light accent — sky blue for secondary highlights */
  accentLight: '#64C3FD',
  /** Accent glow — used for shadows and ambient effects */
  accentGlow: 'rgba(0, 64, 144, 0.2)',
  /** Accent border — subtle blue for panel edges */
  accentBorder: 'rgba(0, 64, 144, 0.15)',
  /** Accent border hover — stronger blue on interaction */
  accentBorderHover: 'rgba(0, 64, 144, 0.3)',
  /** Accent surface — very light tint for selected/active states */
  accentSurface: 'rgba(0, 64, 144, 0.06)',
  /** Primary text — dark ink for headings and body */
  textPrimary: '#1a1a2e',
  /** Secondary text — warm gray for descriptions */
  textSecondary: '#555770',
  /** Muted text — light gray for labels and metadata */
  textMuted: '#8b8fa3',
  /** Sidebar background — glass treatment */
  sidebarBg: 'rgba(255, 255, 255, 0.45)',
  /** Angular brand red */
  angularRed: '#DD0031',
} as const);

export type Colors = typeof colors;
