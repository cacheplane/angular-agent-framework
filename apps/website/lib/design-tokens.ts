/**
 * Website-local re-export of the shared design tokens.
 *
 * Kept as a barrel so existing imports of the form
 * `import { tokens } from '../../lib/design-tokens'` keep working.
 * New code should import directly from `@ngaf/design-tokens`.
 */
export {
  tokens,
  type Tokens,
  colors,
  glass,
  gradient,
  glow,
  typography,
  surfaces,
  shadows,
  radius,
  space,
} from '@ngaf/design-tokens';
