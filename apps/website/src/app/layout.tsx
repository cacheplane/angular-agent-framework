import type { Metadata } from 'next';
import { EB_Garamond, Inter, JetBrains_Mono } from 'next/font/google';
import './global.css';
import { Nav } from '../components/shared/Nav';
import { Footer } from '../components/shared/Footer';
import { AnnouncementToast } from '../components/shared/AnnouncementToast';
import {
  DEFAULT_META_DESCRIPTION,
  DEFAULT_SOCIAL_IMAGE,
  LONG_SUBHEAD,
  PRIMARY_TAGLINE,
  SITE_NAME,
  SITE_ORIGIN,
} from '../lib/site-metadata';

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
    title: 'Agent UI for Angular',
    description: LONG_SUBHEAD,
    type: 'website',
    siteName: SITE_NAME,
    url: '/',
    images: [DEFAULT_SOCIAL_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Agent UI for Angular',
    description: LONG_SUBHEAD,
    images: [DEFAULT_SOCIAL_IMAGE],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${garamond.variable} ${inter.variable} ${mono.variable}`}>
      <body>
        <Nav />
        <main>{children}</main>
        <Footer />
        <AnnouncementToast />
      </body>
    </html>
  );
}
