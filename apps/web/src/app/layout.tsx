import type { ReactNode } from 'react';
import { IBM_Plex_Sans, IBM_Plex_Mono, Fraunces } from 'next/font/google';
import { Toaster } from 'sonner';
import { ThemeProvider } from '../components/theme-provider';
import './globals.css';

const sans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-sans' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-mono' });
const display = Fraunces({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-display' });

export const metadata = {
  title: 'vacti',
  description: 'Vulnerability Assessment + Threat Intelligence platform',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${mono.variable} ${display.variable}`}>
      <body className="min-h-screen bg-bg font-sans text-fg antialiased">
        <ThemeProvider>
          {children}
          <Toaster richColors position="top-right" toastOptions={{ className: 'font-sans' }} />
        </ThemeProvider>
      </body>
    </html>
  );
}
