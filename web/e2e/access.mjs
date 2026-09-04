/**
 * The accessibility guarantees, measured on the rendered page.
 *
 * These are contracts rather than a checklist someone ran once. Contrast is
 * computed from what the browser actually painted, not from the token values,
 * because a colour is only as good as the surface it lands on; the focus tour
 * walks the page the way a keyboard user does and fails on anything it reaches
 * that cannot be seen.
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://localhost:5199'
/** Normal text. Large text (>=24px, or >=18.66px bold) is allowed 3:1. */
const AA_NORMAL = 4.5
const AA_LARGE = 3

const failures = []

function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures.push(name)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const pageErrors = []
page.on('pageerror', (err) => pageErrors.push(String(err.message)))

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
// The comparison is client-only and the wizard fills in after mount.
await page.waitForSelector('#proof video', { timeout: 20_000 })
await page.waitForTimeout(2500)

/* ------------------------------------------------------------------ contrast */

const contrast = await page.evaluate(
  ({ normal, large }) => {
    const lin = (c) => {
      const v = c / 255
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
    }
    const parse = (value) => {
      const n = value.match(/[\d.]+/g)?.map(Number)
      return n && n.length >= 3 ? { r: n[0], g: n[1], b: n[2], a: n.length > 3 ? n[3] : 1 } : null
    }
    const lum = ({ r, g, b }) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
    const over = (fg, bg) => ({
      r: fg.r * fg.a + bg.r * (1 - fg.a),
      g: fg.g * fg.a + bg.g * (1 - fg.a),
      b: fg.b * fg.a + bg.b * (1 - fg.a),
      a: 1,
    })
    /** The first ancestor that actually paints something. */
    const backdrop = (el) => {
      let node = el
      while (node) {
        const bg = parse(getComputedStyle(node).backgroundColor)
        if (bg && bg.a > 0.95) return bg
        node = node.parentElement
      }
      return { r: 0, g: 0, b: 0, a: 1 }
    }

    const worst = []
    for (const el of document.querySelectorAll('body *')) {
      // Only elements holding their own visible words.
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0)
      if (!own) continue
      const style = getComputedStyle(el)
      if (style.visibility === 'hidden' || style.display === 'none') continue
      const box = el.getBoundingClientRect()
      if (box.width < 2 || box.height < 2) continue
      // sr-only text is not painted, so it has nothing to contrast against.
      if (box.width <= 1 && box.height <= 1) continue

      const fg = parse(style.color)
      if (!fg) continue
      const solid = fg.a < 1 ? over(fg, backdrop(el)) : fg
      const bg = backdrop(el)
      const a = lum(solid) + 0.05
      const b = lum(bg) + 0.05
      const ratio = Math.max(a, b) / Math.min(a, b)

      const size = parseFloat(style.fontSize)
      const bold = Number(style.fontWeight) >= 700
      const threshold = size >= 24 || (bold && size >= 18.66) ? large : normal
      if (ratio < threshold) {
        worst.push({
          text: (el.textContent ?? '').trim().slice(0, 42),
          color: style.color,
          size: Math.round(size * 10) / 10,
          ratio: Math.round(ratio * 100) / 100,
          needs: threshold,
        })
      }
    }
    return worst
  },
  { normal: AA_NORMAL, large: AA_LARGE },
)

check(
  'every painted string clears its AA threshold',
  contrast.length === 0,
  contrast.length ? JSON.stringify(contrast.slice(0, 4)) : 'checked against the colour actually behind it',
)

/* ---------------------------------------------------------- heading structure */

const headings = await page.evaluate(() =>
  [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => Number(h.tagName[1])),
)
check('exactly one h1', headings.filter((l) => l === 1).length === 1, `levels: ${headings.join(', ')}`)
check(
  'no heading level is skipped',
  headings.every((level, i) => i === 0 || level <= headings[i - 1] + 1),
)

/* ------------------------------------------------------------------ landmarks */

const landmarks = await page.evaluate(() => ({
  main: document.querySelectorAll('main').length,
  // A footer inside main is scoped to it and is not contentinfo.
  contentinfo: [...document.querySelectorAll('footer')].filter((f) => !f.closest('main')).length,
  unnamedSections: [...document.querySelectorAll('section')].filter(
    (s) => !s.getAttribute('aria-label') && !s.getAttribute('aria-labelledby'),
  ).length,
}))
check('one main landmark', landmarks.main === 1, String(landmarks.main))
check('a contentinfo landmark exists', landmarks.contentinfo === 1, String(landmarks.contentinfo))
check('every section is named', landmarks.unnamedSections === 0, `${landmarks.unnamedSections} unnamed`)

/* ----------------------------------------------------------------- radiogroups */

const groups = await page.evaluate(() =>
  [...document.querySelectorAll('[role="radiogroup"]')].map((g) => ({
    label: g.getAttribute('aria-label'),
    radios: g.querySelectorAll('[role="radio"]').length,
    stops: [...g.querySelectorAll('[role="radio"]')].filter((r) => r.tabIndex === 0).length,
    checked: g.querySelectorAll('[role="radio"][aria-checked="true"]').length,
  })),
)
check('every radiogroup is labelled', groups.every((g) => g.label), JSON.stringify(groups.map((g) => g.label)))
check(
  'a radiogroup is one tab stop, not one per option',
  groups.every((g) => g.stops === 1),
  JSON.stringify(groups.map((g) => `${g.label}: ${g.stops}/${g.radios}`)),
)
check('exactly one option is checked per group', groups.every((g) => g.checked === 1))

/* ----------------------------------------------------------------- focus tour */

/*
 * Tab through the whole page and refuse anything that can be reached but not
 * seen. Scroll-revealed sections start at opacity 0, and an element faded to
 * nothing is still in the tab order - a keyboard user lands on a download link
 * that is not on the screen.
 */
await page.evaluate(() => window.scrollTo(0, 0))
await page.waitForTimeout(400)
/*
 * Walked a fixed number of times rather than until a repeat.
 *
 * A native <video controls> is one element holding a whole shadow-DOM toolbar,
 * so seven consecutive tabs all report the same host and any "stop when we see
 * something twice" rule ends the walk immediately. Counting distinct elements
 * afterwards is the honest version.
 */
const invisible = []
const reached = new Set()
for (let i = 0; i < 45; i += 1) {
  await page.keyboard.press('Tab')
  const at = await page.evaluate(() => {
    const el = document.activeElement
    if (!el || el === document.body || el === document.documentElement) return null
    const box = el.getBoundingClientRect()
    let opacity = 1
    let node = el
    while (node && node !== document.body) {
      opacity *= Number(getComputedStyle(node).opacity)
      node = node.parentElement
    }
    return {
      tag: el.tagName.toLowerCase(),
      label: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 36),
      opacity: Math.round(opacity * 100) / 100,
      onScreen: box.bottom > 0 && box.top < window.innerHeight && box.width > 0,
    }
  })
  if (!at) break
  reached.add(`${at.tag}:${at.label}`)
  if (at.opacity < 0.1 || !at.onScreen) invisible.push(at)
}

check('the tab order reaches the whole page', reached.size >= 6, `${reached.size} distinct controls`)
check(
  'nothing in the tab order is invisible when it is reached',
  invisible.length === 0,
  invisible.length ? JSON.stringify(invisible.slice(0, 4)) : `${reached.size} controls, all on screen`,
)

/* -------------------------------------------------------- overflow, four sizes */

for (const width of [390, 768, 1024, 1440]) {
  await page.setViewportSize({ width, height: 900 })
  await page.waitForTimeout(600)
  const bad = await page.evaluate(() => {
    const root = document.documentElement
    /*
     * Only text that is actually lost.
     *
     * An earlier version flagged anything wider than its box, which caught
     * every progress bar and scaled inner element on the page - overflowing a
     * fixed box is how those are built. What costs a reader something is
     * overflow that is hidden with no ellipsis to show for it: the words are
     * simply gone. Scrollable regions are fine, they can be reached.
     */
    const cut = [...document.querySelectorAll('body *')]
      .filter((el) => {
        const style = getComputedStyle(el)
        if (style.display === 'none' || style.visibility === 'hidden') return false
        if (!['hidden', 'clip'].includes(style.overflowX)) return false
        if (style.textOverflow === 'ellipsis') return false
        // sr-only is a 1px clipped box by construction; that is the technique,
        // not a defect, and its text is meant for listeners rather than readers.
        if (el.clientWidth <= 1 || el.clientHeight <= 1) return false
        if (getComputedStyle(el).clipPath !== 'none') return false
        const holdsText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
        if (!holdsText) return false
        return el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0
      })
      .map((el) => `"${el.textContent.trim().slice(0, 18)}" in ${el.tagName.toLowerCase()}`)
    return { page: root.scrollWidth - root.clientWidth, cut: cut.slice(0, 4) }
  })
  check(`no horizontal overflow at ${width}px`, bad.page <= 1, `${bad.page}px`)
  check(`no text is cut off at ${width}px`, bad.cut.length === 0, bad.cut.join(', ') || 'clean')
}

check('no uncaught errors', pageErrors.length === 0, pageErrors.join(' | '))

await browser.close()

console.log(`\n${'='.repeat(64)}`)
if (failures.length > 0) {
  console.error(`${failures.length} check(s) failed:\n  ${failures.join('\n  ')}`)
  process.exit(1)
}
console.log('access: all checks passed')
