import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { cssVars, ThemeProvider } from '@ngaf/ui-react';
import type { Theme } from '@ngaf/design-tokens';
import { AnalyticsBootstrap } from '../components/analytics-bootstrap';
import './cockpit.css';

export const metadata = {
  title: 'Cockpit — Angular Agent Framework',
  description: 'The live reference app for the Angular Agent Framework. Real LangGraph + AG-UI agents through the Angular surface you’ll ship.',
  openGraph: {
    title: 'Cockpit — Angular Agent Framework',
    description: 'The live reference app for the framework. Real LangGraph + AG-UI agents through the same Angular surface you’ll ship.',
    type: 'website',
    siteName: 'Cockpit',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cockpit — Angular Agent Framework',
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
    <html lang="en" data-theme={theme} style={cssVars(theme) as React.CSSProperties}>
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
