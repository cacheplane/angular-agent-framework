import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Call-to-action buttons inside a `<Callout>`.
 *
 * **A CTA belongs only in a callout whose purpose is to send the reader
 * somewhere to run or see something.** Explanatory callouts ("Mental model",
 * "Why this matters", "Node return values merge, not replace") and cautions
 * ("Never expose API keys") keep prose links: 152 callouts ship in the docs
 * and most of them are prose, not doors. A button on an explanation trains
 * readers to ignore buttons.
 *
 * Keep the prose too. The button is the action; the prose is the context that
 * says why you would take it.
 */
export function CalloutActions({ children }: { children: ReactNode }) {
  return <div data-mdx="callout-actions">{children}</div>;
}

interface CalloutActionProps {
  href: string;
  /** `primary` is filled; `secondary` is outlined. Defaults to `primary`. */
  variant?: 'primary' | 'secondary';
  children: ReactNode;
}

/**
 * An href is internal only if it stays on this document or this site:
 * same-document (`#section`), site-relative (`/docs/...`, `?query`).
 * Everything else — including a protocol-relative `//host/path` (which
 * *looks* site-relative but resolves against whatever host the current
 * scheme applies to, i.e. leaves the site) and `mailto:`/`tel:` URIs — is
 * external.
 */
function isExternalHref(href: string): boolean {
  const isSiteRelative =
    (href.startsWith('/') && !href.startsWith('//')) ||
    href.startsWith('#') ||
    href.startsWith('?');
  return !isSiteRelative;
}

export function CalloutAction({
  href,
  variant = 'primary',
  children,
}: CalloutActionProps) {
  const isExternal = isExternalHref(href);

  return (
    <Link
      href={href}
      // `.docs-prose a` underlines text links. This is a button, and an
      // underline through it reads as a rendering bug.
      data-mdx-chrome=""
      data-mdx="callout-action"
      data-variant={variant}
      {...(isExternal
        ? { target: '_blank', rel: 'noopener noreferrer' }
        : {})}
    >
      {children}
    </Link>
  );
}
