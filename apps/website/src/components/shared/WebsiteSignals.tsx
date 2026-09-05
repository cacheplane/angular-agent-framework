'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { observeWebsitePath } from '../../lib/growth/website-collector';
import type { WebsiteCatalog } from '../../lib/growth/website-metadata';
export function WebsiteSignals({ catalog }: { catalog: WebsiteCatalog }) {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname) observeWebsitePath(pathname, catalog);
  }, [pathname, catalog]);
  return null;
}
