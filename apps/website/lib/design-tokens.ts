/**
 * Website-local re-export of the shared design tokens.
 *
 * Kept as a barrel so existing imports of the form
 * `import { tokens } from '../../lib/design-tokens'` keep working.
 * New code should import directly from `@threadplane/design-tokens`.
 */
export {
  tokens,
  type Tokens,
  colors,
  typography,
  surfaces,
  shadows,
  radius,
  space,
} from '@threadplane/design-tokens';
