import type { MetadataRoute } from 'next';
import { getCanonicalUrl, getSitemapRoutes } from '../lib/site-metadata';

export default function sitemap(): MetadataRoute.Sitemap {
  return getSitemapRoutes().map((route) => ({
    url: getCanonicalUrl(route),
    changeFrequency: route.startsWith('/docs') ? 'weekly' : 'monthly',
    priority: route === '/' ? 1 : route.startsWith('/docs') ? 0.8 : 0.7,
  }));
}
