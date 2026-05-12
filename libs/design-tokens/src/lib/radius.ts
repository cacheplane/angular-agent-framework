/**
 * Border radius scale.
 *
 * `sm` for compact controls (pills, small buttons), `md` for standard
 * cards/buttons, `lg` for hero cards and frames, `xl` for prominent
 * containers. `full` is for fully-rounded shapes (avatars, status dots).
 */
export const radius = Object.freeze({
  sm: '6px',
  md: '10px',
  lg: '14px',
  xl: '20px',
  full: '999px',
} as const);

export type Radius = typeof radius;
