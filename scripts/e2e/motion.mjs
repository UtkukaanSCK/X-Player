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
  for (const el of document.querySelectorAll('.stat, .feature-card, .install-card, .compare-side, .code-block')) {
    const cs = getComputedStyle(el)
    const box = el.getBoundingClientRect()
    if (Number.parseFloat(cs.opacity) < 0.9) bad.push(`${el.className.split(' ')[0]} opacity=${cs.opacity}`)
    else if (box.height < 10) bad.push(`${el.className.split(' ')[0]} height=${box.height}`)
  }
  return bad
})
check('every animated block ends up visible', invisible.length === 0, invisible.slice(0, 6).join('; '))

// These are measurements, not decoration: at rest each counter must read
// exactly the number it was given, never a value from part-way through a tween.
const counters = await normal.evaluate(() =>
  [...document.querySelectorAll('.stat-value span[data-count]')].map((e) => ({
    shown: e.textContent,
    expected: e.dataset.count,
  })),
)
check(
  'stat counters settle on their true values',
  counters.length > 0 && counters.every((c) => c.shown === c.expected),
  counters.map((c) => `${c.shown}/${c.expected}`).join(', '),
)

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
  for (const el of document.querySelectorAll('h1, h2, .feature-card, .stat, .install-card, .code-block')) {
    const cs = getComputedStyle(el)
    if (Number.parseFloat(cs.opacity) < 0.9) problems.push(`${el.className || el.tagName} opacity=${cs.opacity}`)
  }
  for (const w of document.querySelectorAll('.word')) {
    if (Number.parseFloat(getComputedStyle(w).opacity) < 0.9) problems.push(`word "${w.textContent}" dimmed`)
  }
  return problems
})
check('nothing is left hidden by a skipped animation', hidden.length === 0, hidden.slice(0, 5).join('; '))

check(
  'headings are present and readable',
  (await reduced.locator('h1, h2').count()) >= 6,
  String(await reduced.locator('h1, h2').count()),
)
check(
  'no horizontal overflow',
  !(await reduced.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)),
)

// Decorative layers must be hidden from assistive tech.
const undecorated = await reduced.evaluate(
  () =>
    [...document.querySelectorAll('.layer.depth-0, .layer.depth-1, .layer.depth-2, .layer.depth-5')].filter(
      (el) => el.getAttribute('aria-hidden') !== 'true',
    ).length,
)
check('decorative layers are aria-hidden', undecorated === 0, `${undecorated} exposed`)

await reduced.close()
await browser.close()

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed: ${failures.join(', ')}`)
  process.exit(1)
}
console.log('\nmotion: all checks passed')
