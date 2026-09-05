/**
 * What a host has to be able to serve for this site to work in public.
 *
 * Run against the exported build rather than the dev server:
 *
 *   npm run build && npm run serve
 *   BASE_URL=http://localhost:5199 node e2e/deploy.mjs
 *
 * Every check here is something that fails silently in production. A missing
 * favicon, a link card served as a binary download, a demo clip answered from
 * cache so the throttling has nothing to throttle - none of them throw, and
 * none of them are visible from a dev server.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.BASE_URL ?? 'http://localhost:5199'
const OUT = 'out'

const failures = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures.push(name)
}

const head = async (path) => {
  try {
    const res = await fetch(`${BASE}${path}`)
    return { status: res.status, type: res.headers.get('content-type') ?? '', cache: res.headers.get('cache-control') ?? '' }
  } catch (err) {
    return { status: 0, type: String(err), cache: '' }
  }
}

/* ------------------------------------------------------------ what it serves */

for (const [path, expectedType] of [
  ['/', 'text/html'],
  ['/icon.png', 'image/png'],
  ['/apple-icon.png', 'image/png'],
  ['/og.png', 'image/png'],
  ['/robots.txt', 'text/plain'],
  ['/sitemap.xml', 'application/xml'],
    /* Two spellings, both correct. text/javascript is what the current spec
       prefers and application/javascript is what RFC 4329 said; hosts differ
       and browsers take either. Pinning one failed a deployment that was
       serving the worker perfectly well. */
    ['/x-player-netsim-sw.js', ['text/javascript', 'application/javascript']],
  ['/media/demo-long.mp4', 'video/mp4'],
]) {
  const res = await head(path)
    const accepted = Array.isArray(expectedType) ? expectedType : [expectedType]
    check(
      `${path} is served as ${accepted.join(' or ')}`,
      res.status === 200 && accepted.some((type) => res.type.startsWith(type)),
      `${res.status} ${res.type}`,
    )
}

const missing = await head('/a-page-that-does-not-exist')
check('an unknown path returns a 404 page', missing.status === 404 && missing.type.startsWith('text/html'), String(missing.status))

/* ------------------------------------------------------------------ caching */

/*
 * A cached clip means the throttle throttles nothing, so the second visit
 * shows two identical videos beside a caption insisting otherwise.
 *
 * Which mechanism prevents that depends on the host. Vercel is told to send
 * no-store; GitHub Pages sends what it likes and cannot be overridden. So the
 * guarantee cannot live in a header, and the check below is on the thing that
 * runs everywhere: the worker fetching past the HTTP cache. The header check
 * that remains only rejects a directive that would be wrong on any host.
 */
const clip = await head('/media/demo-long.mp4')
check(
  'the demo clip is never marked immutable',
  !clip.cache.includes('immutable'),
  clip.cache || '(no cache-control, which the worker covers for)',
)

const workerSource = await (await fetch(`${BASE}/x-player-netsim-sw.js`)).text()
check(
  'the worker fetches the clip past the HTTP cache',
  workerSource.includes("cache: 'no-store'") ||
    workerSource.includes('cache: "no-store"'),
  'the only thing keeping the throttle honest on a host that sets its own headers',
)

/* -------------------------------------------------------------- the markup */

const html = readFileSync(join(OUT, 'index.html'), 'utf8')

check('the link card is a file with an extension', /og:image" content="https?:\/\/[^"]+\/og\.png"/.test(html), 'hosts that guess types from extensions serve an extensionless file as a download')
check('the card URL is absolute', /og:image" content="https?:\/\//.test(html))
check('a canonical URL is declared', /rel="canonical"/.test(html))
check('the description is present', /name="description" content="[^"]{40,}"/.test(html))
check('the theme colour is set, so the browser chrome matches', /name="theme-color"/.test(html))
check('the page declares its language', /<html[^>]+lang="en"/.test(html))
check('a favicon is linked', /rel="icon"/.test(html))

const robots = readFileSync(join(OUT, 'robots.txt'), 'utf8')
check('robots points at the sitemap', robots.includes('Sitemap:'), robots.split('\n')[0])

/* ---------------------------------------------------- what ships, and its size */

const mediaDir = join(OUT, 'media')
const clips = readdirSync(mediaDir).filter((name) => name.endsWith('.mp4'))
check(
  'only the clip the page plays is shipped',
  clips.length === 1 && clips[0] === 'demo-long.mp4',
  clips.join(', ') || '(none)',
)

// Bytes all the way down, converted once at the end. Dividing inside the
// recursion added megabytes to bytes and reported a 6 MB build as 0.2 MB.
const bytesIn = (dir) =>
  readdirSync(dir, { withFileTypes: true }).reduce((sum, entry) => {
    const path = join(dir, entry.name)
    return sum + (entry.isDirectory() ? bytesIn(path) : statSync(path).size)
  }, 0)

const total = bytesIn(OUT) / 1024 / 1024
const clipMb = statSync(join(mediaDir, 'demo-long.mp4')).size / 1024 / 1024
check(
  'the build is mostly the demo clip, not accidental weight',
  total - clipMb < 3,
  `${total.toFixed(1)} MB total, ${clipMb.toFixed(1)} MB of it the clip`,
)

/* -------------------------------------------------------- what the wizard offers */

const releases = readFileSync(join('lib', 'releases.ts'), 'utf8')
const claimsRelease = /export const published = true/.test(releases)

check('the wizard is on the page', html.includes('id="get"'))

// The one thing the wizard must never do. A download button that 404s is worse
// than no download section at all, and nothing else on the page would reveal it.
const releaseLinks = [...html.matchAll(/href="([^"]*\/releases\/download\/[^"]*)"/g)].map((m) => m[1])
check(
  claimsRelease
    ? 'a published release offers real downloads'
    : 'nothing is offered for download before a release exists',
  claimsRelease ? releaseLinks.length >= 1 : releaseLinks.length === 0,
  releaseLinks.join(', ') || '(none)',
)

/*
 * The copy moved because the fact did.
 *
 * This looked for "never run", which described a build that existed and had
 * not been launched. macOS and Linux were never built at all, so the row now
 * says the honest thing instead - and a platform with no file says so rather
 * than offering a button for it.
 */
check(
  'the platforms with no build say so',
  html.includes('Not in this release yet'),
  'macOS and Linux are configured but have not been built',
)

// The library files the wizard hands over have to be there to hand over.
for (const path of [
  '/downloads/embed/x-player.iife.js',
  '/downloads/embed/hls.min.js',
  '/downloads/lib/x-player.es.js',
  '/downloads/lib/style.css',
]) {
  const res = await head(path)
  check(`${path} is downloadable`, res.status === 200, String(res.status))
}

check('the vercel configuration parses', (() => {
  try {
    JSON.parse(readFileSync('vercel.json', 'utf8'))
    return true
  } catch {
    return false
  }
})())

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed:\n  ${failures.join('\n  ')}`)
  process.exit(1)
}
console.log('\ndeploy: all checks passed')
