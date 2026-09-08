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
  return {
    display: h1 ? getComputedStyle(h1).fontFamily.split(',')[0].replace(/["']/g, '') : '',
    mono: mono ? getComputedStyle(mono).fontFamily.split(',')[0].replace(/["']/g, '') : '',
  }
})
check('the display face loaded', /Archivo/i.test(faces.display), faces.display)
check('the mono face loaded', /JetBrains/i.test(faces.mono), faces.mono)
await fonts.close()

await browser.close()

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed:\n  ${failures.join('\n  ')}`)
  process.exit(1)
}
console.log('\nmotion: all checks passed')
