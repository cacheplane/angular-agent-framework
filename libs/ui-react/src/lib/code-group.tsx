'use client';
import * as React from 'react';
import { cn } from './utils';

function CodeGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  const [active, setActive] = React.useState(0);
  const blocks = React.Children.toArray(children).filter(React.isValidElement);

  const titles = blocks.map((block, i) => {
    const pre = block as React.ReactElement<{ 'data-title'?: string }>;
    return pre.props['data-title'] ?? `File ${i + 1}`;
  });

  return (
    <div className={cn(
      'rounded-xl border border-[var(--ds-glass-border)] shadow-[var(--ds-glass-shadow)] overflow-hidden mb-4',
      className
    )}>
      <div className="flex gap-0 bg-[rgba(26,27,38,0.95)] border-b border-white/[0.06]">
        {titles.map((title, i) => (
          <button
            key={title}
            onClick={() => setActive(i)}
            className={cn(
              'px-3.5 py-2 font-mono text-[0.7rem] bg-transparent border-none cursor-pointer',
              active === i ? 'text-[#a9b1d6] bg-white/[0.05]' : 'text-[#4A527A]'
            )}
          >
            {title}
          </button>
        ))}
      </div>
      <div>{blocks[active]}</div>
    </div>
  );
}

export { CodeGroup };
