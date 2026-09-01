import type { ReactNode } from 'react';

type CalloutType = 'tip' | 'warning' | 'info' | 'danger';

interface Props {
  type?: CalloutType;
  title?: string;
  children: ReactNode;
}

/** Band label when the author gives no title — the band never renders empty. */
const KIND_LABEL: Record<CalloutType, string> = {
  tip: 'Tip',
  warning: 'Warning',
  info: 'Note',
  danger: 'Danger',
};

const ICON_PATHS: Record<CalloutType, ReactNode> = {
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  tip: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" />
    </>
  ),
  warning: (
    <>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  danger: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </>
  ),
};

export function Callout({ type = 'info', title, children }: Props) {
  return (
    <div data-mdx="callout" data-tone={type}>
      <div className="mdx-callout-band">
        <svg
          className="mdx-callout-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {ICON_PATHS[type]}
        </svg>
        <strong className="mdx-callout-title">
          {title ? <span className="sr-only">{KIND_LABEL[type]}: </span> : null}
          {title ?? KIND_LABEL[type]}
        </strong>
      </div>
      <div className="mdx-callout-body">{children}</div>
    </div>
  );
}
