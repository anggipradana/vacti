import type { ReactNode } from 'react';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Toaster } from 'sonner';
import { ThemeProvider } from '../components/theme-provider';
import './globals.css';

export const metadata = {
  title: 'vacti',
  description: 'Vulnerability Assessment + Threat Intelligence platform',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen bg-bg font-sans text-fg antialiased">
        <ThemeProvider>
          {children}
          <Toaster richColors position="top-right" toastOptions={{ className: 'font-sans' }} />
        </ThemeProvider>
      </body>
    </html>
  );
}
