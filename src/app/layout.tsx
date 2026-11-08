import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'METAL // Band Studio & Live Hub',
  description: 'Espacio colaborativo en tiempo real para producción, maquetación y directo.',
  manifest: '/manifest.json',
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
      <body className="min-h-screen bg-[#050507] text-zinc-100 selection:bg-rose-900 selection:text-white">
        {/* Textura ambiental sutil superior */}
        <div className="pointer-events-none fixed inset-x-0 top-0 h-64 bg-gradient-to-b from-rose-950/15 via-violet-950/5 to-transparent z-0" />
        <main className="relative z-10 mx-auto max-w-2xl min-h-screen pb-20">
          {children}
        </main>
      </body>
    </html>
  );
}

