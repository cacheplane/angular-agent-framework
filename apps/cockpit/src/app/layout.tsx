import type { ReactNode } from 'react';

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
      <body>{children}</body>
    </html>
  );
}
