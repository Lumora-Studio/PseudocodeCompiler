import type { MetadataRoute } from 'next';
import { canIndexSite, getSiteOrigin } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    // Previews remain crawlable so bots can see their noindex metadata.
    rules: { userAgent: '*', allow: '/', disallow: '/api/' },
    sitemap: canIndexSite() ? `${getSiteOrigin()}/sitemap.xml` : undefined,
  };
}
