/**
 * Motion and accessibility guardrails for the landing site.
 *
 * The animation is decoration. Under prefers-reduced-motion the page must be
 * fully readable without it, and GSAP must never even be downloaded.
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://localhost:5199'
const failures = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures.push(name)
}

const browser = await chromium.launch()

/* ------------------------------------------------- reduced motion off */

const normal = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const normalRequests = []
normal.on('request', (r) => normalRequests.push(r.url()))
await normal.goto(BASE, { waitUntil: 'networkidle' })
await normal.waitForTimeout(2500)
check('gsap loads when motion is allowed', normalRequests.some((u) => /gsap/i.test(u)))

// Scroll the whole page and make sure nothing an animation was supposed to
// reveal is left invisible. This caught stat cards stuck at opacity 0 because
// content-visibility hid them from ScrollTrigger's measurements.
for (let y = 0; y < 12; y++) {
  await normal.evaluate((i) => window.scrollTo(0, i * window.innerHeight * 0.8), y)
  await normal.waitForTimeout(450)
}
await normal.waitForTimeout(1200)
const invisible = await normal.evaluate(() => {
  const bad = []
  for (const el of document.querySelectorAll('.specstrip, .compare-side, .code-block, .spec-list > div, .scene-head')) {
    const cs = getComputedStyle(el)
    const box = el.getBoundingClientRect()
    if (Number.parseFloat(cs.opacity) < 0.9) bad.push(`${el.className.split(' ')[0]} opacity=${cs.opacity}`)
    else if (box.height < 10) bad.push(`${el.className.split(' ')[0]} height=${box.height}`)
  }
  return bad
})
check('every animated block ends up visible', invisible.length === 0, invisible.slice(0, 6).join('; '))

// The playhead rail is the page's main piece of motion and its whole job is to
// say where you are, so it has to actually track the scroll.
const railMoved = await normal.evaluate(() => {
  const fill = document.querySelector('.rail-fill')
  if (!fill) return 'missing'
  const m = /scaleY\(([\d.]+)\)/.exec(fill.style.transform ?? '')
  return m ? Number(m[1]) : 'unset'
})
check('rail fill follows the scroll', typeof railMoved === 'number' && railMoved > 0.5, String(railMoved))

const marked = await normal.evaluate(() => document.querySelectorAll('.rail-mark').length)
check('rail lists every chapter', marked === 4, String(marked))

await normal.close()

/* -------------------------------------------------- reduced motion on */

const reduced = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
const reducedRequests = []
reduced.on('request', (r) => reducedRequests.push(r.url()))
await reduced.goto(BASE, { waitUntil: 'networkidle' })
await reduced.waitForTimeout(2500)

check('gsap is never downloaded under reduced motion', !reducedRequests.some((u) => /gsap|ScrollTrigger/i.test(u)))

// Everything must be legible at rest: nothing left dimmed or clipped by an
// animation that will now never run.
const hidden = await reduced.evaluate(() => {
  const problems = []
  for (const el of document.querySelectorAll('h1, h2, .specstrip, .spec-list > div, .code-block')) {
    const cs = getComputedStyle(el)
    if (Number.parseFloat(cs.opacity) < 0.9) problems.push(`${el.className || el.tagName} opacity=${cs.opacity}`)
  }
  return problems
})
check('nothing is left hidden by a skipped animation', hidden.length === 0, hidden.slice(0, 5).join('; '))

check(
  'headings are present and readable',
  (await reduced.locator('h1, h2').count()) >= 4,
  String(await reduced.locator('h1, h2').count()),
)
check(
  'no horizontal overflow',
  !(await reduced.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)),
)

// Typography is the point of the redesign: nothing may fall back to the system
// stack, which is what made the page look generic in the first place.
const faces = await reduced.evaluate(() => {
  const first = (s) => getComputedStyle(document.querySelector(s)).fontFamily.split(',')[0].replace(/["']/g, '')
  return { display: first('h1'), body: first('.lede'), mono: first('.marker') }
})
check('display face loaded', faces.display === 'Bricolage Grotesque', faces.display)
check('body face loaded', faces.body === 'IBM Plex Sans', faces.body)
check('mono face loaded', faces.mono === 'IBM Plex Mono', faces.mono)

await reduced.close()
await browser.close()

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed: ${failures.join(', ')}`)
  process.exit(1)
}
console.log('\nmotion: all checks passed')
