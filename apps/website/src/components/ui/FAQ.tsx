import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface FAQItem {
  q: string;
  a: ReactNode;
}

interface FAQProps {
  items: FAQItem[];
  className?: string;
}

/**
 * Native-details FAQ accordion. Keyboard accessible out of the box.
 * Each item can be opened independently; no shared exclusivity.
 */
export function FAQ({ items, className }: FAQProps) {
  return (
    <div data-ui="faq" className={cn(className)}>
      {items.map((item, i) => (
        <details key={i} data-ui="faq-item">
          <summary>
            <span>{item.q}</span>
            <span aria-hidden="true" data-ui="faq-chevron">
              ▼
            </span>
          </summary>
          <div>{item.a}</div>
        </details>
      ))}
    </div>
  );
}
