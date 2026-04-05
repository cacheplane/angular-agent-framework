import * as React from 'react';
import { cn } from './utils';

const CALLOUT_CONFIG = {
  info: { border: 'border-l-[var(--ds-accent)]', bg: 'bg-[rgba(0,64,144,0.04)]', labelColor: 'text-[var(--ds-accent)]' },
  warning: { border: 'border-l-amber-500', bg: 'bg-amber-500/[0.04]', labelColor: 'text-amber-500' },
  tip: { border: 'border-l-green-500', bg: 'bg-green-500/[0.04]', labelColor: 'text-green-500' },
  danger: { border: 'border-l-red-500', bg: 'bg-red-500/[0.04]', labelColor: 'text-red-500' },
} as const;

interface CalloutProps {
  type?: keyof typeof CALLOUT_CONFIG;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

function Callout({ type = 'info', title, children, className }: CalloutProps) {
  const config = CALLOUT_CONFIG[type];
  return (
    <div className={cn(
      'rounded-lg border-l-[3px] p-3 px-4 mb-4',
      config.border, config.bg,
      className
    )}>
      {title && (
        <div className={cn('font-mono text-[0.8rem] font-semibold mb-1', config.labelColor)}>
          {title}
        </div>
      )}
      <div className="text-sm text-[var(--ds-text-secondary)] leading-relaxed">
        {children}
      </div>
    </div>
  );
}

export { Callout };
