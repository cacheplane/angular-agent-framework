import type { HTMLAttributes, ReactNode } from 'react';

interface FormCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  compact?: boolean;
}

export function FormCard({ children, compact = false, ...rest }: FormCardProps) {
  return (
    <div data-ui="form-card" data-compact={compact ? '' : undefined} {...rest}>
      {children}
    </div>
  );
}
