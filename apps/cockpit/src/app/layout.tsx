import type { ReactNode } from 'react';
import { cssVars } from '@ngaf/ui-react';
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

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" style={cssVars as React.CSSProperties}>
      <body
        className="min-h-screen font-sans antialiased"
        style={{
          background: 'var(--ds-surface)',
          color: 'var(--ds-text-primary)',
        }}
      >
        {children}
      </body>
    </html>
  );
}
