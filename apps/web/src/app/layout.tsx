import type { ReactNode } from 'react';
import { Plus_Jakarta_Sans, IBM_Plex_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { ThemeProvider } from '../components/theme-provider';
import './globals.css';

const sans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
});
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono' });

export const metadata = {
  title: 'vacti',
  description: 'Vulnerability Assessment + Threat Intelligence platform',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-bg font-sans text-fg antialiased">
        <ThemeProvider>
          {children}
          <Toaster richColors position="top-right" toastOptions={{ className: 'font-sans' }} />
        </ThemeProvider>
      </body>
    </html>
  );
}
