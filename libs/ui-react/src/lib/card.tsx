import * as React from 'react';
import { cn } from './utils';

function CardGroup({ cols = 2, children, className }: { cols?: number; children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn('grid gap-3 mb-4', className)}
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
    >
      {children}
    </div>
  );
}

function Card({ title, href, icon, children, className }: { title: string; href: string; icon?: string; children: React.ReactNode; className?: string }) {
  return (
    <a href={href} className={cn('no-underline', className)}>
      <div className={cn(
        'p-4 rounded-[10px] border border-[var(--ds-glass-border)]',
        'bg-[var(--ds-glass-bg)] backdrop-blur-[var(--ds-glass-blur)] [-webkit-backdrop-filter:blur(var(--ds-glass-blur))]',
        'transition-all cursor-pointer',
        'hover:shadow-[var(--ds-glow-card)]'
      )}>
        {icon && <div className="text-xl mb-1.5">{icon}</div>}
        <div className="font-[var(--ds-font-serif)] font-bold text-base text-[var(--ds-text-primary)] mb-1">{title}</div>
        <div className="text-[0.8rem] text-[var(--ds-text-secondary)] leading-normal">{children}</div>
      </div>
    </a>
  );
}

export { CardGroup, Card };
