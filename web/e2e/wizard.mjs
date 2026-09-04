/**
 * The wizard hands over files and prints their weight beside them.
 *
 * Both halves of that are promises. A size next to a download link is a claim
 * about the bytes behind it, and a wizard whose whole point is subtracting has
 * to actually subtract - if the streaming engine stayed in the list for someone
 * who only plays MP4, the page would be arguing against itself.
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://localhost:5199'

const failures = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures.push(name)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } })
const pageErrors = []
page.on('pageerror', (err) => pageErrors.push(String(err.message)))

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('#get')
// StartAtTop resets the scroll on mount; anything before that is undone.
await page.waitForTimeout(2600)

/** The version the page claims, taken from the page rather than assumed. */
const VERSION = (await page.evaluate(
  () => document.querySelector('#get [aria-live] p')?.textContent ?? '',
)).match(/version ([0-9.]+)/)?.[1] ?? ''

const pick = (group, label) => page.locator(`[aria-label="${group}"] button`, { hasText: label }).click()

/** Everything the manifest currently claims. */
const manifest = () =>
  page.evaluate(() => ({
    files: [...document.querySelectorAll('#get [aria-live] > div')].map((row) => ({
      name: row.querySelector('.font-mono')?.textContent?.trim() ?? '',
      href: row.querySelector('a')?.getAttribute('href') ?? null,
    })),
    text: document.querySelector('#get')?.textContent ?? '',
  }))

/* ---------------------------------------------------------------- the app path */

check('the wizard opens on the desktop app', (await manifest()).text.includes('The desktop app'))
/*
 * A download button is only ever offered for a file that is in the release.
 *
 * This started life as "nothing is offered before a release exists", which was
 * one flag for the whole section. The first release carried Windows alone, and
 * flipping that flag put a .dmg and an AppImage on the page that had never been
 * built - two buttons answering 404, which is the exact thing the flag was for.
 * The rule that survives is per platform: a row that says it has no build must
 * not also hand out a link to one.
 */
const offers = await page.evaluate(() =>
  [...document.querySelectorAll('#get [aria-live] > div')].map((row) => ({
    saysMissing: (row.textContent ?? '').includes('Not in this release yet'),
    download: [...row.querySelectorAll('a')]
      .map((a) => a.getAttribute('href') ?? '')
      .find((href) => href.includes('/releases/download/')) ?? null,
  })),
)
check(
  'no platform both says it has no build and links to one',
  offers.every((row) => !(row.saysMissing && row.download)),
  offers.filter((r) => r.saysMissing && r.download).map((r) => r.download).join(', ') || 'consistent',
)
/*
 * And it actually resolves.
 *
 * The two checks above are about the page agreeing with itself, which it can do
 * while being wrong: mark a platform released that was never built and the row
 * stops saying it is missing, so both pass and the button still answers 404.
 * The only claim worth making is the one the reader will test, so this asks
 * GitHub. HEAD, because the asset is 188 MB.
 */
for (const row of offers.filter((r) => r.download)) {
  let status = 0
  try {
    status = (await fetch(row.download, { method: 'HEAD', redirect: 'follow' })).status
  } catch (err) {
    status = `unreachable: ${String(err).slice(0, 60)}`
  }
  check(
    `the offered download resolves: ${row.download.split('/').pop()}`,
    status === 200,
    String(status),
  )
}

check(
  'every download offered is under the version the page names',
  offers.every((row) => !row.download || row.download.includes(`/download/v${VERSION}/`)),
  offers.map((r) => r.download).filter(Boolean).join(', ') || 'none offered',
)

/*
 * The same rule, applied to the other link.
 *
 * `published` guarded the download and nothing guarded this one, so while the
 * repository did not exist the desktop answer's only offer was a 404. If the
 * page says the source is not up yet, it must not also link to it.
 */
const app = await page.evaluate(() => ({
  saysUnpublished: (document.querySelector('#get')?.textContent ?? '').includes('not on GitHub yet'),
  repoLinks: [...document.querySelectorAll('#get a')]
    .map((a) => a.getAttribute('href') ?? '')
    .filter((href) => href.includes('X-Player-App')),
}))
check(
  'no link points at a repository the page says does not exist',
  !app.saysUnpublished || app.repoLinks.length === 0,
  app.repoLinks.join(', ') || 'nothing linked',
)

/* ------------------------------------------------------------ the library path */

await pick('What are you doing?', 'Put a player')
await page.waitForTimeout(300)

const plain = await manifest()
check('choosing MP4 asks for one file', plain.files.length === 1, plain.files.map((f) => f.name).join(', '))
check('and it is the embed bundle', plain.files[0]?.name === 'x-player.iife.js', plain.files[0]?.name)
check(
  'the streaming engine is not in the list at all',
  !plain.text.includes('hls.min.js'),
  'a page that never opens a stream never fetches it',
)
check('nothing is deferred when nothing streams', plain.text.includes('nothing'))

await pick('What will it play?', 'HLS')
await page.waitForTimeout(300)

const streaming = await manifest()
check('choosing HLS adds the engine', streaming.files.length === 2, String(streaming.files.length))
check('the second file is hls.min.js', streaming.files[1]?.name === 'hls.min.js', streaming.files[1]?.name)

/* ----------------------------------------- every offered file is real and sized */

const claims = await page.evaluate(() =>
  [...document.querySelectorAll('#get [aria-live] > div')]
    .map((row) => {
      const href = row.querySelector('a')?.getAttribute('href')
      const raw = row.textContent?.match(/([\d.]+) kB raw/)?.[1]
      return href && raw ? { href, kb: Number(raw) } : null
    })
    .filter(Boolean),
)

check('the manifest offers files with sizes', claims.length >= 2, `${claims.length} claim(s)`)

for (const claim of claims) {
  // Resolved, not concatenated. The href is absolute from the origin and
  // already carries any base path, so gluing it onto a BASE that also has one
  // asks for /X-Player/X-Player/... and quietly measures a 404 instead.
  const url = new URL(claim.href, BASE).toString()
  const res = await fetch(url)
  const actual = (await res.arrayBuffer()).byteLength / 1024
  check(
    `${claim.href.split('/').pop()} downloads and weighs what the page says`,
    res.ok && Math.abs(actual - claim.kb) < 0.1,
    `claimed ${claim.kb} kB, got ${actual.toFixed(1)} kB`,
  )
}

/* ----------------------------------------------------------- the React branch */

await pick('Where does it go?', 'A React app')
await page.waitForTimeout(300)
const react = await manifest()
check(
  'React asks for the module and the stylesheet',
  react.files[0]?.name === 'x-player.es.js' && react.files[1]?.name === 'style.css',
  react.files.map((f) => f.name).join(', '),
)
check('the React snippet replaced the HTML one', react.text.includes("from 'x-player'"))

await pick('Where does it go?', 'Neither, use a CDN')
await page.waitForTimeout(300)
const cdn = await page.evaluate(() =>
  [...document.querySelectorAll('#get [aria-live] a')].map((a) => a.getAttribute('href') ?? ''),
)
check(
  'the CDN answer hosts nothing locally',
  cdn.length > 0 && cdn.every((href) => href.startsWith('https://cdn.jsdelivr.net')),
  cdn.join(', '),
)

/* ------------------------------------------------------------------ the basics */

const controls = await page.evaluate(() => ({
  radios: document.querySelectorAll('#get [role="radio"]').length,
  checked: document.querySelectorAll('#get [role="radio"][aria-checked="true"]').length,
  live: document.querySelectorAll('#get [aria-live]').length,
}))
check('every choice is a labelled radio', controls.radios === 7, `${controls.radios} controls: two uses, three targets, two source kinds`)
check('one answer per question is marked', controls.checked === 3, `${controls.checked} checked`)
check('the manifest announces its changes', controls.live >= 1)

await page.setViewportSize({ width: 390, height: 844 })
await page.waitForTimeout(500)
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
)
check('no horizontal overflow on a phone', overflow <= 1, `${overflow}px`)

check('no uncaught errors', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '))

await browser.close()

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed:\n  ${failures.join('\n  ')}`)
  process.exit(1)
}
console.log('\nwizard: all checks passed')
