import type { Metadata } from 'next';
import { EB_Garamond, Inter, JetBrains_Mono } from 'next/font/google';
import './global.css';
import { Nav } from '../components/shared/Nav';
import { Footer } from '../components/shared/Footer';

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
  title: 'Angular Stream Resource — Signal-Native Streaming for Angular + LangGraph',
  description: 'The Enterprise Streaming Resource for LangChain and Angular. Signal-native streaming, thread persistence, and production patterns for Angular 20+.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${garamond.variable} ${inter.variable} ${mono.variable}`}>
      <body>
        <Nav />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
