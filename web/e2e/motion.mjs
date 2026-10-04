/**
 * The scroll animation is decoration. Someone who asked for less motion must
 * still get the whole page, and the comparison must still work - it is the
 * argument, not an effect.
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://localhost:5175'

const failures = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures.push(name)
}

const browser = await chromium.launch()

/* ------------------------------------------------------- motion as intended */

const moving = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await moving.goto(BASE, { waitUntil: 'domcontentloaded' })
await moving.waitForSelector('#proof [role="radio"]', { timeout: 30_000 })

const atTop = await moving.evaluate(() => {
  const stage = document.querySelector('#proof [style*="transform"]')
  return stage ? getComputedStyle(stage).transform : 'none'
})
await moving.evaluate(() => window.scrollTo(0, window.innerHeight * 0.5))
await moving.waitForTimeout(700)
const scrolled = await moving.evaluate(() => {
  const stage = document.querySelector('#proof [style*="transform"]')
  return stage ? getComputedStyle(stage).transform : 'none'
})
check('the stage moves with the scroll', atTop !== scrolled, `${atTop} -> ${scrolled}`)

/*
 * Scrolling moves the picture and nothing else.
 *
 * It used to switch the comparison to Slow 2G on the way past, which meant
 * the page changed its own demonstration while someone was reading it and
 * nobody could look at the throttled case except when the scroll decided.
 * The two buttons are the only thing that changes it now, so this scrolls the
 * whole way and requires the choice to be where it was left.
 */
await moving.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.45))
await moving.waitForTimeout(2500)
const afterScrolling = await moving.locator('#proof [role="radio"][aria-checked="true"]').innerText()
check(
  'scrolling does not change the connection by itself',
  afterScrolling.trim() === 'Normal',
  `ended on ${afterScrolling.trim()}`,
)

/* And the buttons still do, which is what makes the check above mean something. */
await moving.evaluate(() => window.scrollTo(0, 0))
await moving.waitForTimeout(600)
await moving.locator('#proof [role="radio"]', { hasText: 'Slow 2G' }).first().click()
await moving.waitForTimeout(800)
const picked = await moving.locator('#proof [role="radio"][aria-checked="true"]').innerText()
check('choosing Slow 2G still selects it', picked.trim() === 'Slow 2G', picked.trim())
await moving.close()

/* ------------------------------------------------------------ reduced motion */

const still = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
await still.goto(BASE, { waitUntil: 'domcontentloaded' })
await still.waitForSelector('#proof [role="radio"]', { timeout: 30_000 })

const beforeScroll = await still.evaluate(() => {
  const stage = document.querySelector('#proof [style*="transform"]')
  return stage ? getComputedStyle(stage).transform : 'none'
})
await still.evaluate(() => window.scrollTo(0, window.innerHeight * 0.5))
await still.waitForTimeout(700)
const afterScroll = await still.evaluate(() => {
  const stage = document.querySelector('#proof [style*="transform"]')
  return stage ? getComputedStyle(stage).transform : 'none'
})
check('nothing is transformed by scrolling under reduced motion', beforeScroll === afterScroll, afterScroll)

check(
  'the comparison still works under reduced motion',
  (await still.locator('#proof [role="radio"]').count()) === 2 &&
    (await still.locator('#proof video').count()) === 2,
)

const visible = await still.evaluate(() => {
  const bits = [...document.querySelectorAll('#source h2, #source a, #proof h1')]
  return bits.every((el) => Number(getComputedStyle(el).opacity) > 0.05)
})
check('nothing is left invisible by a skipped animation', visible)
await still.close()

/* ------------------------------------------------------------------- fonts */

const fonts = await browser.newPage()
await fonts.goto(BASE, { waitUntil: 'domcontentloaded' })
await fonts.waitForSelector('#proof')
await fonts.waitForTimeout(1500)
const faces = await fonts.evaluate(() => {
  const h1 = document.querySelector('#proof h1')
  const mono = document.querySelector('#proof [class*="font-mono"]')
  const names = (el) =>
    el ? getComputedStyle(el).fontFamily.split(',').map((s) => s.trim().replace(/["']/g, '')) : []
  return {
    h1Found: Boolean(h1),
    stack: names(h1),
    display: names(h1)[0] ?? '',
    mono: names(mono)[0] ?? '',
    fontsSize: document.fonts.size,
    /* Does the browser have a system UI face behind -apple-system? An unknown
       family falls through to monospace, so the same text measures the same
       with and without it; on macOS it measures differently. */
    probe: (() => {
      const ctx = document.createElement('canvas').getContext('2d')
      const text = 'Hamburgefonstiv 0123456789 Wwiilm'
      const width = (font) => {
        ctx.font = font
        return ctx.measureText(text).width
      }
      const plain = width('16px monospace')
      const apple = width('16px -apple-system, monospace')
      const blink = width('16px BlinkMacSystemFont, monospace')
      return { plain, apple, blink, resolved: apple !== plain || blink !== plain }
    })(),
    archivo: [...document.fonts].filter((f) => /Archivo/i.test(f.family) && !/Fallback/i.test(f.family)).map((f) => f.status),
  }
})
/* Two claims, kept apart. "The display face loaded": Archivo is in the stack
   ahead of the generic fallbacks and the browser holds a loaded Archivo
   FontFace. "The stack starts with the system face": Apple devices get SF. */
const archivoAt = faces.stack.findIndex((n) => /Archivo/i.test(n))
const genericAt = faces.stack.findIndex((n) => n === 'ui-sans-serif')
check('font setup: the h1 and the font set were found', faces.h1Found && faces.fontsSize > 0, `h1 ${faces.h1Found}, ${faces.fontsSize} faces`)
check('the stack starts with the system face', faces.display === '-apple-system', faces.stack.join(', '))
check('font setup: the system-face probe measured text', faces.probe.plain > 0 && faces.probe.apple > 0, JSON.stringify(faces.probe))
// Where the system face is absent (here: anything but macOS) the probe must say so,
// or the "loaded" half below would be skipped everywhere and prove nothing.
if (process.platform !== 'darwin') {
  check('font setup: no system face resolves on this platform', !faces.probe.resolved, JSON.stringify(faces.probe))
}
/* On a machine where -apple-system resolves, Archivo is never used, so its
   FontFace stays unloaded with the page behaving correctly. The order half
   still holds; only "loaded" is waived, and the detail says so. */
const archivoLoaded = faces.archivo.some((s) => s === 'loaded')
check(
  'the display face loaded',
  archivoAt >= 0 && genericAt > archivoAt && (archivoLoaded || faces.probe.resolved),
  faces.probe.resolved && !archivoLoaded
    ? `system face in use, Archivo not needed | ${faces.stack.join(', ')}`
    : `${faces.stack.join(', ')} | Archivo FontFaces: ${faces.archivo.join(', ') || 'none'}`,
)
check('the mono face loaded', /JetBrains/i.test(faces.mono), faces.mono)
await fonts.close()

await browser.close()

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed:\n  ${failures.join('\n  ')}`)
  process.exit(1)
}
console.log('\nmotion: all checks passed')
