import type { Metadata } from 'next';

export const siteName = 'Pseudocode Compiler';
export const siteDescription = 'Write and run Cambridge-style pseudocode online. Compile to Python, explore algorithms with editable flowcharts, and learn with worked IGCSE examples.';

export function getSiteOrigin(): string | undefined {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const value = configured || (productionHost ? `https://${productionHost}` : undefined);
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return undefined;
    if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

export function canIndexSite(): boolean {
  return Boolean(getSiteOrigin()) && process.env.BUILD_TARGET !== 'electron' &&
    process.env.NODE_ENV === 'production' &&
    (!process.env.VERCEL_ENV || process.env.VERCEL_ENV === 'production');
}

export function pageMetadata(path: string, title: string, description: string): Metadata {
  const origin = getSiteOrigin();
  const url = origin ? new URL(path, origin).href : undefined;
  const image = origin ? `${origin}/icon.png` : undefined;
  return {
    title,
    description,
    alternates: url ? { canonical: url } : undefined,
    openGraph: { type: 'website', title, description, url, siteName, locale: 'en_US', images: image ? [{ url: image, alt: siteName }] : undefined },
    twitter: { card: 'summary', title, description, images: image ? [image] : undefined },
  };
}
