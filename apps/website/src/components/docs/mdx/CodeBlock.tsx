'use client';
import { useRef, useState } from 'react';
import { analyticsEvents } from '../../../lib/analytics/events';
import { track } from '../../../lib/analytics/client';
import { observeInstallCopy } from '../../../lib/growth/website-collector';

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="5" width="9" height="9" rx="1.5" />
      <path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8.5l3.5 3.5L13 5" />
    </svg>
  );
}

export function Pre({ children, className, ...props }: React.HTMLAttributes<HTMLPreElement>) {
  const ref = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const text = ref.current?.textContent ?? '';
    await navigator.clipboard.writeText(text);
    observeInstallCopy(text);
    track(analyticsEvents.docsCopyCodeClick, {
      surface: 'docs',
      cta_id: 'copy_code',
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mdx-pre-wrap">
      <pre ref={ref} {...props} className={className ? `${className} mdx-pre` : 'mdx-pre'}>{children}</pre>
      <button
        onClick={copy}
        aria-label={copied ? 'Copied' : 'Copy code'}
        data-copied={copied ? '' : undefined}
        className="mdx-pre-copy"
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
    </div>
  );
}
