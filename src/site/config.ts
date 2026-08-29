/** Every outward-facing link lives here, so a rename is a one-line change. */

export const GITHUB_USER = 'UtkukaanSCK'
export const REPO_NAME = 'x-player'

export const REPO_URL = `https://github.com/${GITHUB_USER}/${REPO_NAME}`
export const ZIP_URL = `${REPO_URL}/archive/refs/heads/main.zip`
export const ISSUES_URL = `${REPO_URL}/issues`
export const NPM_GITHUB_SPEC = `github:${GITHUB_USER}/${REPO_NAME}`

/** jsDelivr can serve straight from a GitHub tag, so no npm publish is needed. */
export const CDN_BASE = `https://cdn.jsdelivr.net/gh/${GITHUB_USER}/${REPO_NAME}@v1.0.0/dist/embed`

/** Files copied into the site build by `copyDistributables` in vite.config.ts. */
export const LOCAL_EMBED_URL = '/downloads/embed/x-player.iife.js'
export const LOCAL_HLS_URL = '/downloads/embed/hls.min.js'

export const DEMO_MEDIA = {
  mp4: '/media/demo.mp4',
  webm: '/media/demo.webm',
  poster: '/media/demo.jpg',
  tracks: [
    { src: '/media/demo-en.vtt', label: 'English', srclang: 'en', default: false },
    { src: '/media/demo-tr.vtt', label: 'Türkçe', srclang: 'tr', default: false },
  ],
}

/** A public HLS test stream, used to show adaptive quality switching. */
export const HLS_SAMPLE = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'
