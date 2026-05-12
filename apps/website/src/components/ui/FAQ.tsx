import type { ReactNode } from 'react';
import { tokens } from '@ngaf/design-tokens';
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
    <div
      data-ui="faq"
      className={cn(className)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {items.map((item, i) => (
        <details
          key={i}
          data-ui="faq-item"
          style={{
            background: tokens.surfaces.surface,
            border: `1px solid ${tokens.surfaces.border}`,
            borderRadius: tokens.radius.lg,
            boxShadow: tokens.shadows.sm,
            padding: '0 20px',
          }}
        >
          <summary
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              padding: '20px 0',
              cursor: 'pointer',
              fontFamily: tokens.typography.fontSans,
              fontSize: 17,
              fontWeight: 600,
              color: tokens.colors.textPrimary,
              listStyle: 'none',
            }}
          >
            <span>{item.q}</span>
            <span
              aria-hidden="true"
              data-ui="faq-chevron"
              style={{
                transition: 'transform 200ms ease',
                fontSize: 14,
                color: tokens.colors.textSecondary,
              }}
            >
              ▼
            </span>
          </summary>
          <div
            style={{
              paddingBottom: 20,
              fontFamily: tokens.typography.fontSans,
              fontSize: 16,
              lineHeight: 1.6,
              color: tokens.colors.textSecondary,
            }}
          >
            {item.a}
          </div>
        </details>
      ))}
    </div>
  );
}
