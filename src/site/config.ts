import type { XPlayerSource, XPlayerTrack } from '../player/types'

/** Every outward-facing link lives here, so a rename is a one-line change. */

export const GITHUB_USER = 'UtkukaanSCK'
export const REPO_NAME = 'X-Player'

export const REPO_URL = `https://github.com/${GITHUB_USER}/${REPO_NAME}`
export const ISSUES_URL = `${REPO_URL}/issues`
export const NPM_GITHUB_SPEC = `github:${GITHUB_USER}/${REPO_NAME}`

/** jsDelivr can serve straight from a GitHub tag, so no npm publish is needed. */
export const CDN_BASE = `https://cdn.jsdelivr.net/gh/${GITHUB_USER}/${REPO_NAME}@v1.0.0/dist/embed`

/** Files copied into the site build by `copyDistributables` in vite.config.ts. */
export const LOCAL_EMBED_URL = '/downloads/embed/x-player.iife.js'

/**
 * The demo clip, encoded at three sizes so the quality menu has something real
 * to switch between. The source material is 854x480, so the ladder stops there:
 * a "1080p" label would be a lie about a file that does not exist.
 */
export const DEMO_SOURCES: XPlayerSource[] = [
  { src: '/media/demo-480p.mp4', label: '480p' },
  { src: '/media/demo-360p.mp4', label: '360p' },
  { src: '/media/demo-240p.mp4', label: '240p' },
]

export const DEMO_TRACKS: XPlayerTrack[] = [
  { src: '/media/demo-en.vtt', label: 'English', srclang: 'en' },
  { src: '/media/demo-tr.vtt', label: 'Türkçe', srclang: 'tr' },
]

export const DEMO_POSTER = '/media/demo.jpg'

/** A public HLS test stream, for adaptive quality switching. */
export const HLS_SAMPLE = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'
