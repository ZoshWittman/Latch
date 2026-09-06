import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Latch - Action Boundary Desk',
  description: 'Action-boundary desk for agent tool calls',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
