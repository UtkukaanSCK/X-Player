/**
 * Checks the two promises the embed bundle makes.
 *
 * 1. Style isolation. `examples/embed-test.html` is a deliberately hostile host
 *    page: global rules on button, input, svg, video and `*`, several with
 *    !important. None of them may reach inside the player.
 * 2. Streaming stays optional. A page that plays an MP4 must never fetch
 *    hls.min.js; a page that opens an HLS source must.
 */
import { gzipSync } from 'node:zlib'
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://localhost:5199'
const BUNDLE = 'dist/embed/x-player.iife.js'
const MAX_GZIP_KB = 30

const failures = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures.push(name)
}

/* -------------------------------------------------------------- size */

const bytes = readFileSync(BUNDLE)
const gzipKb = gzipSync(bytes, { level: 9 }).length / 1024
check(`embed bundle stays under ${MAX_GZIP_KB} kB gzip`, gzipKb < MAX_GZIP_KB, `${gzipKb.toFixed(1)} kB`)
check(
  'hls.js is not bundled into the embed file',
  !['hlsDefaultConfig', 'fragmentTracker', 'abrEwmaFastLive'].some((p) => bytes.includes(p)),
)

const browser = await chromium.launch()

/* ------------------------------------------- MP4 only: no hls.js fetch */

const mp4Page = await browser.newPage({ viewport: { width: 900, height: 700 } })
const mp4Requests = []
mp4Page.on('request', (r) => mp4Requests.push(r.url()))
await mp4Page.goto(`${BASE}/examples/mp4-only.html`, { waitUntil: 'networkidle' })
await mp4Page.waitForTimeout(2500)
check('MP4-only page mounts a player', (await mp4Page.locator('.xp-root').count()) === 1)
check(
  'MP4-only page never fetches hls.min.js',
  !mp4Requests.some((u) => /hls(\.min)?\.js/.test(u)),
  mp4Requests.filter((u) => /hls/.test(u)).join(', '),
)
await mp4Page.close()

/* --------------------------------------- hostile CSS + lazy HLS fetch */

const page = await browser.newPage({ viewport: { width: 1000, height: 900 } })
const requests = []
const pageErrors = []
page.on('request', (r) => requests.push(r.url()))
page.on('pageerror', (e) => pageErrors.push(String(e.message)))

await page.goto(`${BASE}/examples/embed-test.html`, { waitUntil: 'networkidle' })
await page.waitForTimeout(5000)

check('both players mount', (await page.locator('.xp-root').count()) === 2)
check('styles are injected by the bundle', await page.evaluate(() => !!document.getElementById('x-player-styles')))
check('no separate stylesheet is needed', (await page.locator('link[rel=stylesheet]').count()) === 0)

const leak = await page.evaluate(() => {
  const cs = (s) => getComputedStyle(document.querySelector(s))
  const b = cs('.xp-root .xp-btn')
  const svg = cs('.xp-root svg')
  const video = cs('.xp-root video')
  const time = cs('.xp-root .xp-time')
  return {
    background: b.backgroundColor,
    border: b.borderTopWidth,
    padding: b.paddingTop,
    font: b.fontFamily.split(',')[0].replace(/"/g, ''),
    fontSize: b.fontSize,
    textTransform: b.textTransform,
    boxShadow: b.boxShadow,
    svgBorder: svg.borderTopWidth,
    svgMaxWidth: svg.maxWidth,
    videoBorder: video.borderTopWidth,
    videoMaxWidth: video.maxWidth,
    lineHeight: time.lineHeight,
  }
})
check('host button background does not leak', leak.background === 'rgba(0, 0, 0, 0)', leak.background)
check('host button border does not leak', leak.border === '0px', leak.border)
check('host button padding does not leak', leak.padding === '0px', leak.padding)
check('host font does not leak', leak.font === 'system-ui', leak.font)
check('host font-size does not leak', leak.fontSize === '14px', leak.fontSize)
check('host text-transform does not leak', leak.textTransform === 'none', leak.textTransform)
check('host box-shadow does not leak', leak.boxShadow === 'none', leak.boxShadow)
check('host svg border does not leak', leak.svgBorder === '0px', leak.svgBorder)
check('host svg max-width does not leak', leak.svgMaxWidth === 'none', leak.svgMaxWidth)
check('host video border does not leak', leak.videoBorder === '0px', leak.videoBorder)
check('host video max-width does not leak', leak.videoMaxWidth === 'none', leak.videoMaxWidth)
check('host line-height does not leak', Number.parseFloat(leak.lineHeight) < 25, leak.lineHeight)

check('hls.min.js is fetched for the HLS player', requests.some((u) => /hls\.min\.js/.test(u)))

const videos = await page.evaluate(() =>
  [...document.querySelectorAll('video.xp-video')].map((v) => ({
    dur: Number.isFinite(v.duration) ? Math.round(v.duration) : null,
    err: v.error?.code ?? null,
  })),
)
check('both sources load', videos.every((v) => v.dur !== null && v.err === null), JSON.stringify(videos))

await page.locator('.xp-bigplay').first().click()
await page.waitForTimeout(2500)
check('embedded player plays', await page.evaluate(() => !document.querySelector('video.xp-video').paused))

check('no uncaught page errors', pageErrors.length === 0, pageErrors.join(' | '))
await browser.close()

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed: ${failures.join(', ')}`)
  process.exit(1)
}
console.log('\nembed: all checks passed')
