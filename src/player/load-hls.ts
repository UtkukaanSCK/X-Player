import type HlsJs from 'hls.js'

/**
 * Loads hls.js on demand.
 *
 * This is the default implementation, used by the library build and the site:
 * a plain dynamic import, so the bundler emits a lazy chunk and a page that only
 * plays MP4 never downloads it.
 *
 * The embed build swaps this file for `load-hls.embed.ts` — see
 * `vite.embed.config.ts` — because a single-file IIFE bundle cannot code-split.
 */
export async function loadHls(): Promise<typeof HlsJs> {
  const mod = await import('hls.js')
  return mod.default
}
