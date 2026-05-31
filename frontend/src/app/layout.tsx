import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';

import { siteConfig } from '@/lib/config';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

const clash = localFont({ src: '../fonts/ClashDisplay-Variable.ttf', variable: '--font-clash', display: 'swap' });

export const metadata: Metadata = {
  title: siteConfig.seo.title,
  description: siteConfig.seo.description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = siteConfig.theme;

  const htmlStyle = {
    '--brand-primary': theme.primaryColor,
    '--brand-primary-hover': theme.primaryHover,
    '--brand-accent': theme.accentColor,
    '--brand-background': theme.backgroundColor,
    '--brand-surface': theme.surfaceColor,
    '--brand-text-primary': theme.textPrimary,
    '--brand-text-secondary': theme.textSecondary,
    '--brand-font': theme.fontFamily,
  } as React.CSSProperties;

  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} style={htmlStyle}>
      <body className={`min-h-screen flex flex-col ${clash.variable}`}>
        <div className="flex-1 flex flex-col">{children}</div>
      </body>
    </html>
  );
}