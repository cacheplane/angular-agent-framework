import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils';

const glassButtonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-accent)] disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
  {
    variants: {
      variant: {
        primary: 'bg-[var(--ds-accent)] text-white border-none hover:shadow-[var(--ds-glow-button)]',
        outline: 'bg-transparent text-[var(--ds-accent)] border border-[var(--ds-accent-border)] hover:border-[var(--ds-accent-border-hover)] hover:shadow-[var(--ds-glow-border)]',
        ghost: 'bg-transparent text-[var(--ds-text-secondary)] border-none hover:text-[var(--ds-text-primary)] hover:bg-[var(--ds-accent-surface)]',
      },
      size: {
        default: 'px-4 py-2',
        sm: 'px-3 py-1.5 text-xs',
        lg: 'px-6 py-3',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  }
);

interface GlassButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof glassButtonVariants> {
  asChild?: boolean;
}

const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(glassButtonVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);
GlassButton.displayName = 'GlassButton';

export { GlassButton, glassButtonVariants };
