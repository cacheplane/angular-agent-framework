import * as React from 'react';
import { cn } from './utils';

function Steps({ children, className }: { children: React.ReactNode; className?: string }) {
  const steps = React.Children.toArray(children);
  return (
    <div className={cn('flex flex-col gap-4 mb-4', className)}>
      {steps.map((child, i) => {
        if (!React.isValidElement(child)) return null;
        return React.cloneElement(child as React.ReactElement<{ stepNumber: number }>, { stepNumber: i + 1 });
      })}
    </div>
  );
}

function Step({ title, children, stepNumber, className }: { title: string; children: React.ReactNode; stepNumber?: number; className?: string }) {
  return (
    <div className={cn('flex gap-3', className)}>
      <div className="flex flex-col items-center">
        <div className="w-6 h-6 rounded-full bg-[var(--ds-accent)] text-white text-xs font-semibold flex items-center justify-center shrink-0">
          {stepNumber ?? 1}
        </div>
        <div className="w-px flex-1 bg-[var(--ds-accent)]/20 mt-1" />
      </div>
      <div className="flex-1 pb-2">
        <div className="font-semibold text-[0.9rem] text-[var(--ds-text-primary)] mb-1">{title}</div>
        <div className="text-sm text-[var(--ds-text-secondary)] leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

export { Steps, Step };
