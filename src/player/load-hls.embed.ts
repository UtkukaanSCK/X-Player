import type HlsJs from 'hls.js'

/**
 * hls.js loader for the single-file embed build.
 *
 * IIFE output cannot be code-split, so a dynamic import here would be inlined and
 * drag ~184 kB (gzip) into every page — including pages that only ever play an
 * MP4. Instead we inject a script tag the first time an HLS source is opened.
 *
 * Resolution order: an explicit `window.XPlayerHlsUrl`, then a copy sitting next
 * to the embed script (so a self-hosted install needs no CDN at all), then
 * jsDelivr as a last resort.
 */

declare global {
  interface Window {
    Hls?: typeof HlsJs
    /** Point this at your own copy of hls.min.js to skip the CDN entirely. */
    XPlayerHlsUrl?: string
  }
}

const FALLBACK_URL = 'https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js'

/**
 * The URL the embed script itself was loaded from. Captured at module scope
 * because `document.currentScript` is only meaningful during initial execution.
 */
const selfUrl: string | null = (() => {
  if (typeof document === 'undefined') return null
  const current = document.currentScript as HTMLScriptElement | null
  if (current?.src) return current.src
  const guess = Array.from(document.querySelectorAll<HTMLScriptElement>('script[src]'))
    .reverse()
    .find((s) => /x-player[^/]*\.js(\?|#|$)/i.test(s.src))
  return guess?.src ?? null
})()

function siblingUrl(): string | null {
  if (!selfUrl) return null
  try {
    return new URL('hls.min.js', selfUrl).href
  } catch {
    return null
  }
}

function injectScript(url: string): Promise<typeof HlsJs> {
  return new Promise((resolve, reject) => {
    const done = () =>
      window.Hls ? resolve(window.Hls) : reject(new Error('hls.js loaded but window.Hls is missing'))
    const fail = () => reject(new Error(`hls.js could not be loaded from ${url}`))

    const existing = document.querySelector<HTMLScriptElement>(`script[data-x-player-hls="${url}"]`)
    if (existing) {
      if (window.Hls) return resolve(window.Hls)
      existing.addEventListener('load', done, { once: true })
      existing.addEventListener('error', fail, { once: true })
      return
    }

    const el = document.createElement('script')
    el.src = url
    el.async = true
    el.dataset.xPlayerHls = url
    el.addEventListener('load', done, { once: true })
    el.addEventListener('error', fail, { once: true })
    document.head.appendChild(el)
  })
}

let pending: Promise<typeof HlsJs> | null = null

export async function loadHls(): Promise<typeof HlsJs> {
  if (typeof window === 'undefined') throw new Error('hls.js requires a browser environment')
  if (window.Hls) return window.Hls
  if (pending) return pending

  const local = typeof window !== 'undefined' && window.XPlayerHlsUrl
  const first = local || siblingUrl()

  pending = (first ? injectScript(first).catch(() => injectScript(FALLBACK_URL)) : injectScript(FALLBACK_URL)).catch(
    (err) => {
      // Let the next attempt start fresh — a transient network failure shouldn't
      // permanently poison the player.
      pending = null
      throw err
    },
  )
  return pending
}
