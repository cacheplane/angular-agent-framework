import * as React from 'react';
import { cn } from './utils';

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

const GlassPanel = React.forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ hover = false, className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-[10px] border border-[var(--ds-glass-border)] shadow-[var(--ds-glass-shadow)]',
        'backdrop-blur-[var(--ds-glass-blur)] [-webkit-backdrop-filter:blur(var(--ds-glass-blur))]',
        hover
          ? 'bg-[var(--ds-glass-bg-hover)]'
          : 'bg-[var(--ds-glass-bg)]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
GlassPanel.displayName = 'GlassPanel';

export { GlassPanel };
