import type { ReactNode } from 'react';
import { cssVars } from '@cacheplane/ui-react';
import './cockpit.css';

export const metadata = {
  title: 'Cockpit',
  description: 'Integrated cockpit for manifest-driven developer reference demos.',
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
          background: 'var(--ds-gradient-bg-flow)',
          color: 'var(--ds-text-primary)',
        }}
      >
        {children}
      </body>
    </html>
  );
}
