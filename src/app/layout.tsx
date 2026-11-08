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
        {/* Fondo fijo de escenario/estudio de Metal con velo oscuro para máxima legibilidad */}
        <div
          className="pointer-events-none fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/metal-bg.jpg')" }}
        />
        <div className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-b from-[#050507]/75 via-[#050507]/60 to-[#050507]/85" />
        <main className="relative z-10 mx-auto max-w-2xl min-h-screen pb-20">
          {children}
        </main>
      </body>
    </html>
  );
}

