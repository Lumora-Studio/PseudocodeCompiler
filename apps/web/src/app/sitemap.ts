import type { MetadataRoute } from 'next';
import { canIndexSite, getSiteOrigin } from '@/lib/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  if (!canIndexSite()) return [];
  return ['/', '/manual', '/flowcharts'].map((path) => ({
    url: new URL(path, getSiteOrigin()).href,
  }));
}
