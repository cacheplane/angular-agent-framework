import type {
  ReactNode,
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
} from 'react';
import { cn } from '../../lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'md' | 'lg';

interface CommonProps {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  /** Optional right-side icon — typically an arrow for ghost links. */
  trailingIcon?: ReactNode;
  /** Optional left-side icon — typically a brand mark (e.g. the GitHub logo). */
  leadingIcon?: ReactNode;
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

export function Button(props: ButtonProps) {
  const {
    children,
    variant = 'primary',
    size = 'md',
    trailingIcon,
    leadingIcon,
    className,
    style,
  } = props;

  const content = (
    <>
      {leadingIcon ? <span aria-hidden="true">{leadingIcon}</span> : null}
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
      leadingIcon: _li,
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
        style={style}
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
    leadingIcon: _li2,
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
      style={style}
      {...buttonAttrs}
    >
      {content}
    </button>
  );
}
