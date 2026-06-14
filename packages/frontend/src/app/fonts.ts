import { Inter, Manrope } from 'next/font/google';

// Self-hosted, optimized fonts (next/font): inlines @font-face, auto-preloads the
// woff2, and removes the render-blocking fonts.googleapis.com CSS request. Exposed
// as CSS variables consumed by the landing styles.
export const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  variable: '--font-inter',
});

export const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  variable: '--font-manrope',
});
