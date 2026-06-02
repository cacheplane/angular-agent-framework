import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { cssVars, ThemeProvider } from '@threadplane/ui-react';
import type { Theme } from '@threadplane/design-tokens';
import { AnalyticsBootstrap } from '../components/analytics-bootstrap';
import './cockpit.css';
import { EB_Garamond, Inter, JetBrains_Mono } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });
const garamond = EB_Garamond({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-garamond', display: 'swap' });

export const metadata = {
  title: 'Cockpit — Threadplane',
  description: 'The live reference app for Threadplane. Real LangGraph + AG-UI agents through the Angular surface you’ll ship.',
  openGraph: {
    title: 'Cockpit — Threadplane',
    description: 'The live reference app for the framework. Real LangGraph + AG-UI agents through the same Angular surface you’ll ship.',
    type: 'website',
    siteName: 'Cockpit',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cockpit — Threadplane',
    description: 'The live reference app for the framework. Real LangGraph + AG-UI agents through the Angular surface you’ll ship.',
  },
};

interface RootLayoutProps {
  children: ReactNode;
}

export default async function RootLayout({ children }: RootLayoutProps) {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get('theme')?.value;
  const theme: Theme = cookieValue === 'light' ? 'light' : 'dark';

  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${inter.variable} ${mono.variable} ${garamond.variable}`}
      style={cssVars(theme) as React.CSSProperties}
    >
      <body
        className="min-h-screen font-sans antialiased"
        style={{
          background: 'var(--ds-surface)',
          color: 'var(--ds-text-primary)',
        }}
      >
        <AnalyticsBootstrap />
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
      </body>
    </html>
  );
}
