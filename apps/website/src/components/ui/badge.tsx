import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-mono transition-colors',
  {
    variants: {
      variant: {
        default:
          'bg-[rgba(108,142,255,0.08)] border border-[rgba(108,142,255,0.15)] text-foreground',
        primary:
          'bg-primary text-primary-foreground',
        outline:
          'border border-[rgba(108,142,255,0.15)] bg-[rgba(108,142,255,0.08)] text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
