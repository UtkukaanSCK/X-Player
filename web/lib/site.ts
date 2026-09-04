import { normalizeBasePath } from './base-path'

/**
 * Where this site lives, and the facts that follow from that.
 *
 * Absolute URLs are needed in three places a relative one will not do: the
 * canonical link, the sitemap, and the Open Graph image that other sites fetch
 * for a link preview. Set NEXT_PUBLIC_SITE_URL at build time to point them
 * somewhere else without touching the code.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://utkukaansck.github.io/X-Player'

/**
 * The path the site is served under, without a trailing slash.
 *
 * GitHub Pages serves a project repository from /<repo>/, so everything the
 * page addresses by absolute path needs that prefix. Next adds it to its own
 * bundles and to next/link on its own; it does not touch a string handed to a
 * <video src>, an <a href> built by hand, or a service worker registration,
 * which is what withBase is for.
 *
 * Empty when the site sits at a domain root, which is what the two other
 * plausible homes for it - a user site, or a custom domain - would both be.
 */
export const BASE_PATH = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH)

/** Prefixes a root-relative path with the base the site is served under. */
export function withBase(path: string): string {
  return `${BASE_PATH}${path}`
}

export const REPO_URL = 'https://github.com/UtkukaanSCK/X-Player'

export const SITE_NAME = 'X-Player'
export const SITE_TAGLINE = 'A video player that tells you what is happening'
export const SITE_DESCRIPTION =
  'Watch a plain <video> and X-Player on the same throttled connection, and read the numbers off both.'
