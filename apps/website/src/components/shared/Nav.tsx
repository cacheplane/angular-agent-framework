'use client';
import { useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getLibraryConfig, type LibraryId } from '../../lib/docs-config';
import { LogoMark } from '../ui/LogoMark';
import { NavDesktop } from './NavDesktop';
import { NavMobile } from './NavMobile';
import { useNavSurface } from './useNavSurface';

export function Nav() {
  const pathname = usePathname();
  const isDocsPage = pathname.startsWith('/docs');
  const pathParts = pathname.split('/').filter(Boolean);
  const activeLibrary = isDocsPage && pathParts.length >= 2 ? pathParts[1] : '';
  const activeSection = isDocsPage && pathParts.length >= 3 ? pathParts[2] : '';
  const activeSlug = isDocsPage && pathParts.length >= 4 ? pathParts[3] : '';
  // A docs URL without a library segment (e.g. /docs/choosing-an-adapter) is
  // library-neutral. Defaulting to a library here made the drawer claim the
  // reader was inside LangGraph's docs.
  const docsLibrary = (getLibraryConfig(activeLibrary)?.id ??
    null) as LibraryId | null;
  const navRef = useRef<HTMLElement>(null);
  const { surface, sentinelRef } = useNavSurface(pathname);

  return (
    <>
      {/* Outside the fixed <nav> so it actually scrolls: `body` is its
          containing block, so `top: 0` is the top of the document. */}
      <div ref={sentinelRef} className="nav-scroll-sentinel" aria-hidden="true" />
      <nav
        ref={navRef}
        className="fixed top-0 left-0 right-0 z-50 nav-bar"
        data-site-navigation=""
        data-surface={surface}
        data-route={isDocsPage ? 'docs' : 'marketing'}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 md:px-8 md:py-5">
          <Link href="/" className="nav-logo-link">
            <LogoMark size="md" />
          </Link>

          {/* Desktop links */}
          <NavDesktop />

          <NavMobile
            isDocsPage={isDocsPage}
            docsLibrary={docsLibrary}
            activeSection={activeSection}
            activeSlug={activeSlug}
            navRef={navRef}
          />
        </div>
      </nav>
    </>
  );
}
