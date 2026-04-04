/** Single source of truth for all brand design tokens.
 *  CSS custom properties in globals.css must match these values exactly.
 */
export const tokens = {
  colors: {
    bg: '#f8f9fc',
    accent: '#004090',
    accentLight: '#64C3FD',
    accentGlow: 'rgba(0, 64, 144, 0.2)',
    accentBorder: 'rgba(0, 64, 144, 0.15)',
    accentBorderHover: 'rgba(0, 64, 144, 0.3)',
    accentSurface: 'rgba(0, 64, 144, 0.06)',
    textPrimary: '#1a1a2e',
    textSecondary: '#555770',
    textMuted: '#8b8fa3',
    sidebarBg: 'rgba(255, 255, 255, 0.45)',
    angularRed: '#DD0031',
  },
  glass: {
    bg: 'rgba(255, 255, 255, 0.45)',
    bgHover: 'rgba(255, 255, 255, 0.55)',
    blur: '16px',
    border: 'rgba(255, 255, 255, 0.6)',
    shadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
  },
  gradient: {
    warm: 'radial-gradient(circle, rgba(221, 0, 49, 0.18), transparent 70%)',
    cool: 'radial-gradient(circle, rgba(0, 64, 144, 0.18), transparent 70%)',
    coolLight: 'radial-gradient(circle, rgba(100, 195, 253, 0.15), transparent 70%)',
    bgFlow: 'linear-gradient(135deg, #fef0f3 0%, #f4f0ff 45%, #eaf3ff 70%, #e6f4ff 100%)',
  },
  glow: {
    hero: '0 0 60px rgba(0, 64, 144, 0.15)',
    demo: '0 0 30px rgba(0, 64, 144, 0.1)',
    card: '0 0 24px rgba(0, 64, 144, 0.1)',
    border: '0 0 12px rgba(0, 64, 144, 0.08)',
    button: '0 0 16px rgba(0, 64, 144, 0.15)',
  },
} as const;
