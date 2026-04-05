'use client';
import * as React from 'react';
import { cn } from './utils';

function Tabs({ items, children, className }: { items?: string[]; children: React.ReactNode; className?: string }) {
  const [active, setActive] = React.useState(0);
  const tabs = React.Children.toArray(children);
  const labels = items ?? tabs.map((_, i) => `Tab ${i + 1}`);

  return (
    <div className={cn('mb-4', className)}>
      <div className="flex gap-0 border-b border-[var(--ds-accent-border)]">
        {labels.map((label, i) => (
          <button
            key={label}
            onClick={() => setActive(i)}
            className={cn(
              'px-4 py-2 font-mono text-[0.8rem] bg-transparent border-none cursor-pointer transition-colors',
              'border-b-2',
              active === i
                ? 'font-medium text-[var(--ds-accent)] border-b-[var(--ds-accent)]'
                : 'text-[var(--ds-text-muted)] border-b-transparent'
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div>{tabs[active]}</div>
    </div>
  );
}

function Tab({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

export { Tabs, Tab };
