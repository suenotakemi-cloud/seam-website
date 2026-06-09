import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Shippori_Mincho, Inter } from 'next/font/google';
import './globals.css';

const cormorant = Cormorant_Garamond({
  weight: ['300', '400', '500'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-cormorant',
  display: 'swap',
});

const shippori = Shippori_Mincho({
  weight: ['400', '500', '600'],
  subsets: ['latin'],
  variable: '--font-shippori',
  display: 'swap',
});

const inter = Inter({
  weight: ['300', '400', '500', '600'],
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SEAM Hair Karte v3.8',
  description: '髪質だけで選ばない。履歴まで見て、今の髪に必要なケアを。',
  metadataBase: new URL('https://seam.site'),
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#F4F1EA',
};

// SVG ノイズグレイン（mix-blend-multiply で全面に薄く重ねる）
const NOISE_SVG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23n)'/%3E%3C/svg%3E\")";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ja"
      className={`${cormorant.variable} ${shippori.variable} ${inter.variable}`}
    >
      <body className="relative bg-ivory">
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[1] opacity-[0.06] mix-blend-multiply"
          style={{ backgroundImage: NOISE_SVG }}
        />
        <main className="relative z-[2]">{children}</main>
      </body>
    </html>
  );
}
