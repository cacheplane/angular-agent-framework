import type { Metadata } from 'next';
import { EB_Garamond, Inter, JetBrains_Mono } from 'next/font/google';
import './global.css';
import { Nav } from '../components/shared/Nav';
import { Footer } from '../components/shared/Footer';
import { AnnouncementToast } from '../components/shared/AnnouncementToast';
import { DEFAULT_SOCIAL_IMAGE, SITE_NAME, SITE_ORIGIN } from '../lib/site-metadata';

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
  title: 'Angular Agent Framework — Signal-Native Streaming for Angular + LangGraph',
  description: 'The enterprise Angular agent framework for LangChain. Signal-native streaming, thread persistence, and production patterns for Angular 20+.',
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🛩️</text></svg>',
  },
  openGraph: {
    title: 'Angular Agent Framework',
    description: 'Signal-native streaming for LangGraph — production patterns your Angular team can own.',
    type: 'website',
    siteName: SITE_NAME,
    url: '/',
    images: [DEFAULT_SOCIAL_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Angular Agent Framework',
    description: 'Signal-native streaming for LangGraph — production patterns your Angular team can own.',
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
