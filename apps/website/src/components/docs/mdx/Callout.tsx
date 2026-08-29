import type { ReactNode } from 'react';

type CalloutType = 'tip' | 'warning' | 'info' | 'danger';

interface Props {
  type?: CalloutType;
  title?: string;
  children: ReactNode;
}

const ICON: Record<CalloutType, string> = {
  tip: '✓',
  warning: '!',
  info: 'i',
  danger: '✕',
};

export function Callout({ type = 'info', title, children }: Props) {
  return (
    <div data-mdx="callout" data-tone={type}>
      <div className="mdx-callout-header" data-has-title={title ? '' : undefined}>
        <span aria-hidden="true" className="mdx-callout-icon">
          {ICON[type]}
        </span>
        {title ? <strong className="mdx-callout-title">{title}</strong> : null}
      </div>
      <div className="mdx-callout-body">{children}</div>
    </div>
  );
}
