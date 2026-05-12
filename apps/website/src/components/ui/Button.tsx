import type {
  ReactNode,
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  CSSProperties,
} from 'react';
import { tokens } from '@ngaf/design-tokens';
import { cn } from '../../lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'md' | 'lg';

interface CommonProps {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  /** Optional right-side icon — typically an arrow for ghost links. */
  trailingIcon?: ReactNode;
}

type AnchorButtonProps = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'children'> & {
    href: string;
  };

type NativeButtonProps = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
    href?: undefined;
  };

export type ButtonProps = AnchorButtonProps | NativeButtonProps;

interface VariantStyle {
  bg: string;
  color: string;
  border: string;
}

const VARIANT_STYLES: Record<Variant, VariantStyle> = {
  primary: {
    bg: tokens.colors.accent,
    color: tokens.colors.textInverted,
    border: tokens.colors.accent,
  },
  secondary: {
    bg: tokens.surfaces.surface,
    color: tokens.colors.textPrimary,
    border: tokens.surfaces.borderStrong,
  },
  ghost: {
    bg: 'transparent',
    color: tokens.colors.accent,
    border: 'transparent',
  },
};

const SIZE_STYLES: Record<Size, { padding: string; fontSize: number; height: number }> = {
  md: { padding: '0 16px', fontSize: 14, height: 40 },
  lg: { padding: '0 22px', fontSize: 16, height: 48 },
};

export function Button(props: ButtonProps) {
  const {
    children,
    variant = 'primary',
    size = 'md',
    trailingIcon,
    className,
    style,
  } = props;
  const v = VARIANT_STYLES[variant];
  const s = SIZE_STYLES[size];

  const combinedStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: s.height,
    padding: s.padding,
    fontFamily: tokens.typography.fontSans,
    fontSize: s.fontSize,
    fontWeight: 600,
    lineHeight: 1,
    background: v.bg,
    color: v.color,
    border: `1px solid ${v.border}`,
    borderRadius: tokens.radius.md,
    boxShadow: variant === 'primary' ? tokens.shadows.sm : 'none',
    cursor: 'pointer',
    textDecoration: 'none',
    transition:
      'background-color 120ms ease, color 120ms ease, border-color 120ms ease, box-shadow 120ms ease',
    whiteSpace: 'nowrap',
    ...style,
  };

  const content = (
    <>
      <span>{children}</span>
      {trailingIcon ? <span aria-hidden="true">{trailingIcon}</span> : null}
    </>
  );

  if (typeof props.href === 'string') {
    const { href, ...rest } = props as AnchorButtonProps;
    const {
      children: _c,
      variant: _v,
      size: _s,
      trailingIcon: _t,
      className: _cn,
      style: _st,
      ...anchorAttrs
    } = rest;
    return (
      <a
        href={href}
        data-ui="button"
        data-variant={variant}
        data-size={size}
        className={cn(className)}
        style={combinedStyle}
        {...anchorAttrs}
      >
        {content}
      </a>
    );
  }

  const {
    children: _c2,
    variant: _v2,
    size: _s2,
    trailingIcon: _t2,
    className: _cn2,
    style: _st2,
    href: _h,
    ...buttonAttrs
  } = props as NativeButtonProps;
  return (
    <button
      type="button"
      data-ui="button"
      data-variant={variant}
      data-size={size}
      className={cn(className)}
      style={combinedStyle}
      {...buttonAttrs}
    >
      {content}
    </button>
  );
}
