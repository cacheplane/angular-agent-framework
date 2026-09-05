import type { Metadata } from 'next';
import { EB_Garamond, Inter, JetBrains_Mono } from 'next/font/google';
import '@threadplane/design-tokens/tokens.css';
import './global.css';
import { Nav } from '../components/shared/Nav';
import { SiteFooter } from '../components/shared/SiteFooter';
import { AnnouncementToast } from '../components/shared/AnnouncementToast';
import { WebsiteWorkspaceRoot } from '../components/workspace/WebsiteWorkspace';
import { JsonLd } from '../components/shared/JsonLd';
import { rootJsonLd } from '../lib/structured-data';
import {
  DEFAULT_META_DESCRIPTION,
  DEFAULT_SOCIAL_IMAGE_META,
  LONG_SUBHEAD,
  PRIMARY_TAGLINE,
  SITE_NAME,
  SITE_ORIGIN,
} from '../lib/site-metadata';
import { getFormPolicy } from '../lib/growth/form-policy';
import { WebsiteSignals } from '../components/shared/WebsiteSignals';
import { websiteContentCatalog } from '../lib/growth/website-content';

const garamond = EB_Garamond({
  subsets: ['latin'],
  weight: ['400', '700', '800'],
  style: ['normal', 'italic'],
  variable: '--font-garamond',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: PRIMARY_TAGLINE,
  description: DEFAULT_META_DESCRIPTION,
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🛩️</text></svg>',
  },
  openGraph: {
    title: 'Threadplane',
    description: LONG_SUBHEAD,
    type: 'website',
    siteName: SITE_NAME,
    url: '/',
    images: [DEFAULT_SOCIAL_IMAGE_META],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Threadplane',
    description: LONG_SUBHEAD,
    images: [DEFAULT_SOCIAL_IMAGE_META],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const formPolicy = getFormPolicy();
  return (
    <html
      lang="en"
      className={`${garamond.variable} ${inter.variable} ${mono.variable}`}
    >
      <body>
        {/*
          Site-wide structured data, mounted once here so it is present on every
          route. Per-route nodes (BlogPosting, TechArticle) reference the
          Organization by `@id`; those references only resolve because this
          renders alongside them. `rootJsonLd()` is a single `@graph` for that
          reason — do not mount its component builders individually.
        */}
        <JsonLd data={rootJsonLd()} />
        <WebsiteSignals catalog={websiteContentCatalog()} />
        <Nav />
        <div id="site-content">
          <main>
            <WebsiteWorkspaceRoot>{children}</WebsiteWorkspaceRoot>
          </main>
          <SiteFooter formPolicy={formPolicy} />
          <div data-announcement-region="">
            <AnnouncementToast formPolicy={formPolicy} />
          </div>
        </div>
      </body>
    </html>
  );
}
