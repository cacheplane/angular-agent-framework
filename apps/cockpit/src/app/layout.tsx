import type { ReactNode } from 'react';
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
    <html lang="en">
      <body className="cockpit-app">{children}</body>
    </html>
  );
}
