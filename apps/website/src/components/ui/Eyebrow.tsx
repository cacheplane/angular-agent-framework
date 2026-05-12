import type { ReactNode, HTMLAttributes } from 'react';
import { tokens } from '@ngaf/design-tokens';
import { cn } from '../../lib/cn';

type Tone = 'muted' | 'accent' | 'angular';

interface EyebrowProps extends HTMLAttributes<HTMLParagraphElement> {
  children: ReactNode;
  /** Optional color override. Defaults to muted neutral. */
  tone?: Tone;
}

const TONE_COLOR: Record<Tone, string> = {
  muted: tokens.colors.textMuted,
  accent: tokens.colors.accent,
  angular: tokens.colors.angularRed,
};

export function Eyebrow({
  children,
  tone = 'muted',
  className,
  style,
  ...rest
}: EyebrowProps) {
  return (
    <p
      data-ui="eyebrow"
      data-tone={tone}
      className={cn(className)}
      style={{
        fontFamily: tokens.typography.eyebrow.family,
        fontSize: tokens.typography.eyebrow.size,
        fontWeight: tokens.typography.eyebrow.weight,
        letterSpacing: tokens.typography.eyebrow.letterSpacing,
        textTransform: tokens.typography.eyebrow.transform,
        lineHeight: tokens.typography.eyebrow.line,
        color: TONE_COLOR[tone],
        margin: 0,
        ...style,
      }}
      {...rest}
    >
      {children}
    </p>
  );
}
