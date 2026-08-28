import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://palabra-justa.ardipe92.chatgpt.site'),
  title: 'Palabra justa — Juez de Scrabble',
  description: 'Comprueba palabras de Scrabble en español e inglés, al instante y sin conexión.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'Palabra justa',
    description: 'Juez de Scrabble sin conexión',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Palabra justa — Juez de Scrabble sin conexión' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Palabra justa',
    description: 'Juez de Scrabble sin conexión',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
