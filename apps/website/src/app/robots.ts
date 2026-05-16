import type { MetadataRoute } from 'next';
import { getCanonicalUrl } from '../lib/site-metadata';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: getCanonicalUrl('/sitemap.xml'),
  };
}
