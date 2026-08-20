import type { MetadataRoute } from 'next';
import { getCanonicalUrl, getSitemapEntries } from '../lib/site-metadata';

// `changefreq`/`priority` are ignored by Google; `lastmod` is used when it is
// honest, so this emits only that.
export default function sitemap(): MetadataRoute.Sitemap {
  return getSitemapEntries().map((entry) => ({
    url: getCanonicalUrl(entry.route),
    ...(entry.lastModified ? { lastModified: entry.lastModified } : {}),
  }));
}
