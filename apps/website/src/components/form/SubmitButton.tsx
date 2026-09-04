import type { ReactNode } from 'react';
import { Button, type ButtonProps } from '../ui/Button';

type SubmitButtonProps = Omit<Extract<ButtonProps, { href?: undefined }>, 'type' | 'children'> & {
  children: ReactNode;
  pending?: boolean;
  pendingLabel: string;
};

/**
 * Both labels render in the same grid cell (see forms.css) so the button
 * keeps its width when the label swaps. The inactive label is hidden from
 * layout by visibility and from assistive tech by aria-hidden.
 */
export function SubmitButton({ children, pending = false, pendingLabel, disabled, ...rest }: SubmitButtonProps) {
  return (
    <Button
      {...rest}
      type="submit"
      data-submit=""
      data-pending={pending ? '' : undefined}
      aria-busy={pending || undefined}
      disabled={pending || disabled}
    >
      <span data-slot="label" aria-hidden={pending || undefined}>{children}</span>
      <span data-slot="pending" aria-hidden={!pending || undefined}>{pendingLabel}</span>
    </Button>
  );
}
