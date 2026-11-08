import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'METAL // Band Studio & Live Hub',
  description: 'Espacio colaborativo en tiempo real para producción, maquetación y directo.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/logo.png', type: 'image/png', sizes: '512x512' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
    ],
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'METAL',
  },
};

export const viewport: Viewport = {
  themeColor: '#050507',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <body className="min-h-screen bg-[#050507] text-zinc-100 selection:bg-emerald-500 selection:text-zinc-950">
        {/* Textura ambiental sutil superior */}
        <div className="pointer-events-none fixed inset-x-0 top-0 h-64 bg-gradient-to-b from-emerald-950/20 via-emerald-950/5 to-transparent z-0" />
        <main className="relative z-10 mx-auto max-w-2xl min-h-screen pb-20">
          {children}
        </main>
      </body>
    </html>
  );
}

