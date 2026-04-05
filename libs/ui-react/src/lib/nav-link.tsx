import * as React from 'react';
import { cn } from './utils';

interface NavLinkProps {
  href: string;
  active?: boolean;
  children: React.ReactNode;
  className?: string;
}

function NavLink({ href, active = false, children, className }: NavLinkProps) {
  return (
    <a
      href={href}
      className={cn(
        'block px-2 py-1 rounded text-[0.85rem] no-underline transition-colors',
        active
          ? 'text-[var(--ds-accent)] bg-[var(--ds-accent-surface)]'
          : 'text-[var(--ds-text-secondary)] hover:text-[var(--ds-text-primary)]',
        className
      )}
    >
      {children}
    </a>
  );
}

export { NavLink };
