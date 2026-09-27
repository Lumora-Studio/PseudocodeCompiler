import { afterEach, describe, expect, it, vi } from 'vitest';
import { canIndexSite, getSiteOrigin, pageMetadata } from './seo';
import sitemap from '@/app/sitemap';
import robots from '@/app/robots';

afterEach(() => vi.unstubAllEnvs());

describe('search indexing', () => {
  function production() {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://compiler.example.org/');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('BUILD_TARGET', '');
  }
  it('uses one configured origin for canonical, social and sitemap URLs', () => {
    production();
    expect(getSiteOrigin()).toBe('https://compiler.example.org');
    const metadata = pageMetadata('/manual', 'Manual', 'Learn pseudocode');
    expect(metadata.alternates?.canonical).toBe('https://compiler.example.org/manual');
    expect(metadata.openGraph).toMatchObject({ url: 'https://compiler.example.org/manual', title: 'Manual' });
    expect(sitemap().map((entry) => entry.url)).toEqual(['https://compiler.example.org/', 'https://compiler.example.org/manual', 'https://compiler.example.org/flowcharts']);
    expect(robots().sitemap).toBe('https://compiler.example.org/sitemap.xml');
  });
  it('does not index previews, development or Electron', () => {
    production();
    vi.stubEnv('VERCEL_ENV', 'preview');
    expect(canIndexSite()).toBe(false);
    expect(sitemap()).toEqual([]);
    expect(robots().sitemap).toBeUndefined();
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('BUILD_TARGET', 'electron');
    expect(canIndexSite()).toBe(false);
    vi.stubEnv('BUILD_TARGET', '');
    vi.stubEnv('NODE_ENV', 'development');
    expect(canIndexSite()).toBe(false);
  });
  it('falls back only to the production hostname, never an arbitrary preview', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'compiler.vercel.app');
    vi.stubEnv('VERCEL_URL', 'preview-123.vercel.app');
    expect(getSiteOrigin()).toBe('https://compiler.vercel.app');
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', '');
    expect(getSiteOrigin()).toBeUndefined();
  });
  it.each(['garbage', 'javascript:alert(1)', 'http://localhost:3000', 'https://user:password@example.org'])('rejects unsuitable origins: %s', (url) => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', url);
    expect(getSiteOrigin()).toBeUndefined();
  });
});
