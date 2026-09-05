import type { MetadataRoute } from 'next'

import { SITE_URL } from '@/lib/site'

export const dynamic = 'force-static'

/** One page. The sitemap exists so the canonical URL is stated somewhere. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: SITE_URL, lastModified: new Date(), changeFrequency: 'monthly', priority: 1 }]
}
