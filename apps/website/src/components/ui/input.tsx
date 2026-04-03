import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex w-full rounded px-3.5 py-2.5 text-sm text-foreground',
          'bg-[rgba(108,142,255,0.04)] border border-input',
          'placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-[rgba(108,142,255,0.4)] focus-visible:ring-offset-0',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
