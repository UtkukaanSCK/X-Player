/**
 * The page makes claims about two players. This checks every one of them.
 *
 * The comparison is the whole point of the site, so it cannot be allowed to
 * quietly stop working - a throttle that silently does nothing would leave two
 * identical videos playing happily beside a caption insisting one of them is in
 * trouble. Everything below is measured off the real elements.
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://localhost:5175'

const failures = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures.push(name)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

const pageErrors = []
page.on('pageerror', (err) => pageErrors.push(String(err.message)))

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('#proof [role="radio"]', { timeout: 30_000 })

/*
 * Waiting for the worker to actually take control, rather than for a guessed
 * number of seconds.
 *
 * A newly installed worker does not control the page that registered it until it
 * claims its clients, and on a cold first visit - empty HTTP cache, a server
 * that has just started - that took longer than the four seconds this used to
 * sleep through. It failed the suite once in five runs and passed on every
 * retry, which is the worst way for a check to behave.
 */
let controlled = true
try {
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30_000 })
} catch {
  controlled = false
}

// Both players still need a moment on the clock before any rate below means
// anything; this part is a warm-up, not a race being waited on.
await page.waitForTimeout(4000)

/** Both players, read straight off the elements. */
const readBoth = () =>
  page.evaluate(() => {
    const bare = document.querySelector('#proof video:not(.xp-video)')
    const xp = document.querySelector('#proof video.xp-video')
    const at = (v) => (v ? Number(v.currentTime.toFixed(2)) : -1)
    return {
      bare: { t: at(bare), error: bare?.error?.code ?? null, paused: bare?.paused ?? null },
      xp: { t: at(xp), error: xp?.error?.code ?? null, paused: xp?.paused ?? null },
    }
  })

const pick = (label) => page.locator('#proof [role="radio"]', { hasText: label }).click()

/* ------------------------------------------------------------ the apparatus */

check(
  'the throttling worker is controlling the page',
  controlled,
  'without it there is nothing to demonstrate',
)

check(
  'both players are on the page at once',
  await page.evaluate(
    () =>
      !!document.querySelector('#proof video:not(.xp-video)') && !!document.querySelector('#proof video.xp-video'),
  ),
)

check('the page says it is doing the throttling itself', (await page.locator('#proof').innerText()).includes('service worker'))

/* ---------------------------------------------------------------- full speed */

await pick('Normal')
await page.waitForTimeout(6000)
const fast = await readBoth()
check('at full speed both actually play', fast.bare.t > 2 && fast.xp.t > 2, JSON.stringify(fast))

/* ----------------------------------------------------------------- throttled */

await pick('Slow 2G')
await page.waitForTimeout(12_000)
const slowBefore = await readBoth()
await page.waitForTimeout(8000)
const slowAfter = await readBoth()

const bareRate = slowAfter.bare.t - slowBefore.bare.t
const xpRate = slowAfter.xp.t - slowBefore.xp.t
/*
 * Behind real time by a clear margin, expressed as a fraction of the clock
 * rather than a number of seconds. The old constant was 4, tuned against the
 * 854x480 encode; the clip is 480x270 now and the same throttle ratio leaves
 * the player further ahead, because a smaller file buys more seconds of video
 * per buffered byte. Measured across two runs it is 2.7s for the plain video
 * and 4.2s for the player against 8s of clock - a third and a half. Unthrottled
 * both take about the full 8, which is what this separates.
 *
 * That the player does better is the section's whole claim, and the check
 * below is what keeps it from being an unfair fight.
 */
const CRAWLING = 8 * 0.6
check(
  'the throttle really bites: both crawl well behind real time',
  bareRate < CRAWLING && xpRate < CRAWLING,
  `8 s of wall clock bought ${bareRate.toFixed(1)} s and ${xpRate.toFixed(1)} s of video`,
)
check(
  'neither is given an advantage over the other',
  Math.abs(bareRate - xpRate) < 3,
  `${bareRate.toFixed(1)} s vs ${xpRate.toFixed(1)} s`,
)

/* ------------------------------------------------ nothing plays unwatched */

/*
 * Scrolled past, both players stop, and both start again on the way back.
 *
 * They used not to agree about this: the plain video stopped on its own and
 * the player kept decoding, which is a browser heuristic rather than anyone
 * deciding. Checked in both directions, because stopping them is easy and a
 * comparison that never restarts is worse than one that never stops.
 *
 * The section is 200svh with a sticky interior, so this has to scroll past
 * the whole of it - scrolling within it keeps both on screen, which is the
 * point of the sticky.
 */
await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }))
await page.waitForTimeout(2500)
const parked = await readBoth()
check(
  'scrolled past, neither player is still decoding',
  parked.bare.paused === true && parked.xp.paused === true,
  JSON.stringify(parked),
)

await page.waitForTimeout(4000)
const stillParked = await readBoth()
check(
  'and neither creeps forward while away',
  stillParked.bare.t - parked.bare.t < 0.3 && stillParked.xp.t - parked.xp.t < 0.3,
  `bare ${parked.bare.t} -> ${stillParked.bare.t}, xp ${parked.xp.t} -> ${stillParked.xp.t}`,
)

await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }))
await page.waitForTimeout(3000)
const resumed = await readBoth()
check(
  'coming back starts both of them again',
  resumed.bare.paused === false && resumed.xp.paused === false,
  JSON.stringify(resumed),
)

/* ------------------------------------------ the numbers describe the file */

/*
 * The section makes three numeric claims and all of them are about one clip:
 * what it needs, what Normal gives it, and what Slow 2G does not. They are
 * only true of the encode actually shipped, and re-encoding that clip is how
 * they quietly stop being true - it happened once already, when a list said
 * 50 for a clip that needed 48.
 *
 * So the number is derived rather than trusted: the file the page is playing,
 * its own content-length, over the duration the element reports.
 */
/*
 * Only the selected mode shows its own detail line, so the three figures
 * cannot be read from one state. Each is read with its own mode chosen.
 */
const readDetail = async (label, pattern) => {
  await page.locator('#proof [role="radio"]', { hasText: label }).first().click()
  await page.waitForTimeout(700)
  return page.evaluate((source) => {
    const text = document.querySelector('#proof').textContent ?? ''
    const found = text.match(new RegExp(source))
    return found ? Number(found[1]) : null
  }, pattern)
}

const needs = await readDetail('Normal', '([0-9]+) kB.s the clip needs')
const normal = await readDetail('Normal', '([0-9]+) kB.s . comfortably above')
const slow = await readDetail('Slow 2G', '([0-9]+) kB.s . a third')

const real = await page.evaluate(async () => {
  const video = document.querySelector('#proof video')
  const head = await fetch(video.currentSrc, { method: 'HEAD' })
  return {
    file: video.currentSrc.split('/').pop(),
    rate: Number(head.headers.get('content-length')) / video.duration / 1024,
  }
})

/* Put it back, so what follows starts where it used to. */
await page.locator('#proof [role="radio"]', { hasText: 'Normal' }).first().click()
await page.waitForTimeout(600)
check(
  'the page says what the clip actually needs',
  needs !== null && Math.abs(real.rate - needs) < 2,
  `${real.file} really needs ${real.rate.toFixed(1)} kB/s, the page says ${needs}`,
)
check(
  'and the throttle it calls comfortable is above that',
  normal !== null && normal > real.rate * 1.2,
  `${normal} vs ${real.rate.toFixed(1)}`,
)
check(
  'and the one it calls a third really is about a third',
  slow !== null && Math.abs(slow / real.rate - 1 / 3) < 0.12,
  `${slow} is ${(slow / real.rate).toFixed(2)} of ${real.rate.toFixed(1)}`,
)

/* ------------------------------------------------- reloading starts over */

await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.4))
await page.waitForTimeout(600)
const scrolledTo = await page.evaluate(() => Math.round(window.scrollY))
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForSelector('#proof [role="radio"]', { timeout: 30_000 })
await page.waitForTimeout(1200)
const afterReload = await page.evaluate(() => Math.round(window.scrollY))
check('reloading puts you back at the top', afterReload === 0, `was ${scrolledTo}px, now ${afterReload}px`)
check(
  'and the connection starts unthrottled again',
  (await page.locator('#proof [role="radio"][aria-checked="true"]').innerText()).trim() === 'Normal',
)

/* --------------------------------------------------------------- section two */

const repo = await page.locator('#source a[href*="github.com"]').first().getAttribute('href')
check('the second section links to the repository', repo === 'https://github.com/UtkukaanSCK/X-Player', repo ?? '(none)')
check(
  'the link opens safely in a new tab',
  (await page.locator('#source a[href*="github.com"]').first().getAttribute('rel'))?.includes('noopener') === true,
)

/* ------------------------------------------------------------------ the basics */

await page.setViewportSize({ width: 390, height: 844 })
await page.waitForTimeout(800)
const narrow = await page.evaluate(() => ({
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  sideBySide: (() => {
    const panels = document.querySelectorAll('#proof [data-panel]')
    if (panels.length !== 2) return false
    const [a, b] = [...panels].map((p) => p.getBoundingClientRect())
    return Math.abs(a.top - b.top) < 4
  })(),
}))
check('no horizontal overflow on a phone', narrow.overflow <= 1, `${narrow.overflow}px`)
check('the two players stay side by side on a phone', narrow.sideBySide, 'stacked, they are not a comparison')

/*
 * Both players default to the small encode, everywhere.
 *
 * Not because every box needs it - a wide one could show more - but because
 * the section's three figures are ratios against one clip's bitrate, and a
 * second encode in play would leave one of them described by the other's
 * numbers. The larger is still offered, so nobody is stuck with the small one.
 */
const playing = await page.evaluate(() =>
  [...document.querySelectorAll('#proof video')].map((v) => v.currentSrc.split('/').pop()),
)
check(
  'both players default to the same small encode',
  playing.length === 2 && playing.every((name) => name === 'demo-480.mp4'),
  playing.join(', '),
)

/* ------------------------------------------------- seeking under the throttle */

/*
 * A seek has to resume, and the throttle has to still be on while it does.
 *
 * The worker used to re-create the element's request to add cache: no-store,
 * and a media element's request is mode: no-cors - so its headers went behind
 * the no-cors guard and Range, which is not on the CORS safelist, was dropped.
 * A seek to 90s came back 200 with the whole file, so 2.3 MB of already-played
 * video arrived before the first frame anyone was waiting for. Measured at 71
 * seconds.
 *
 * Three things are asserted and only the last is about seeking, because a
 * seek check on its own passes loudest when the worker is broken: a fetch
 * handler that throws never answers, every request goes straight to the
 * server at full speed, and the seeks come back instant. node --check does not
 * catch that - it is a runtime error, not a syntax one.
 *
 * Nor does asserting the response shape help. A fetch from the page is
 * same-origin, so its Range survives even the broken worker: measured 206 with
 * a correct Content-Range on the code that had this bug. Only the element's
 * own no-cors request loses it, and an opaque response cannot be read. So the
 * apparatus is checked directly and the fault is checked by its behaviour.
 */
const seeking = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await seeking.goto(BASE, { waitUntil: 'domcontentloaded' })
await seeking.waitForSelector('#proof video', { timeout: 30_000 })
let seekWorker = true
try {
  await seeking.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30_000 })
} catch {
  seekWorker = false
}
check('the worker is controlling the page while seeking is measured', seekWorker)

/* The throttle is on: three seconds of video cannot arrive instantly at 34 kB/s. */
const warmUp = await seeking.evaluate(async () => {
  const video = document.querySelector('#proof video.xp-video')
  const started = performance.now()
  const ahead = () => {
    let end = 0
    for (let i = 0; i < video.buffered.length; i += 1) end = Math.max(end, video.buffered.end(i))
    return end
  }
  while (ahead() < 3 && performance.now() - started < 20_000) {
    await new Promise((done) => setTimeout(done, 100))
  }
  return { ms: Math.round(performance.now() - started), buffered: +ahead().toFixed(1) }
})
check(
  'and it is actually metering, not passing requests through',
  warmUp.ms >= 1500,
  `three seconds of video took ${warmUp.ms}ms to arrive`,
)

/*
 * Several targets, and the worst of them has to settle.
 *
 * Seeking one hardcoded point measured a keyframe rather than the player. On
 * the encode this check was written against, a seek to 90s cost 2.0s and one
 * to 32s cost 8.0s - same file, same worker, same throttle - because 90.0 sat
 * a third of a second past a keyframe and 32.0 sat ten seconds past one. The
 * margin the check appeared to have was an accident of where a keyframe fell,
 * and re-encoding the clip re-rolls it. Picking a deliberately bad target
 * instead would swap one encode-specific constant for another.
 *
 * Settling is what catches the fault. The broken worker never settled inside
 * the race at any target, so the numeric bound below only guards a partial
 * regression that has never happened - which is a reason to set it clear of
 * false failures rather than tight. The clip now caps its keyframe gap at 4s
 * and the worst measured seek is 5.5s, so 12s is better than two to one.
 */
const SEEK_TARGETS = [32, 41, 63.9, 90]
const SEEK_BOUND_MS = 12_000

const seekTimes = []
for (const target of SEEK_TARGETS) {
  const attempt = await seeking.evaluate(async (t) => {
    const video = document.querySelector('#proof video.xp-video')
    const started = performance.now()
    video.currentTime = t
    const settled = await Promise.race([
      new Promise((done) => video.addEventListener('seeked', () => done(true), { once: true })),
      new Promise((done) => setTimeout(() => done(false), 20_000)),
    ])
    return { ms: Math.round(performance.now() - started), settled }
  }, target)
  seekTimes.push({ target, ...attempt })
  await seeking.waitForTimeout(1200)
}

const stuck = seekTimes.filter((s) => !s.settled)
const slowest = seekTimes.reduce((worst, s) => (s.ms > worst.ms ? s : worst), seekTimes[0])

check(
  'every seek resumes rather than fetching the clip from the start',
  stuck.length === 0,
  stuck.map((s) => `${s.target}s did not settle`).join(', '),
)
check(
  'and the slowest of them is not far off the quickest',
  slowest.ms < SEEK_BOUND_MS,
  seekTimes.map((s) => `${s.target}s ${(s.ms / 1000).toFixed(1)}s`).join(
),
)
await seeking.close()

/* --------------------------------------------------- the metered-link path */

/*
 * The comparison costs about six megabytes, because two players streaming
 * the same two-minute clip is what it is. On a connection that has asked to be
 * spent carefully it must build the apparatus and wait, and it must say the
 * number rather than spending it and explaining afterwards.
 *
 * Both directions are checked. A guard that holds everything back is easy and
 * useless; the one that matters is that nobody else is affected.
 */
/*
 * Watches focus from inside the page, by what the browser reports, not by
 * looking now and then.
 *
 * A polled check cannot be trusted with "focus never rests on <body>": the
 * moment lasts a few milliseconds, and a 100 ms poll steps over it. Three
 * sources are kept, and any one of them is enough to fail:
 *
 *  - every focusin and focusout, with a timestamp. A focusout with no
 *    `relatedTarget` is focus going nowhere; the time to the next focusin is
 *    how long it stayed there. (The consent button's own is the press itself,
 *    its element being removed, and is not counted.)
 *  - a snapshot of `document.activeElement` after every DOM change under the
 *    page. Those callbacks run once the task that changed the DOM has ended,
 *    so they see what the browser would paint: a focus handed on in the same
 *    task is seen on its new holder, one handed on a task later is seen on
 *    <body>, however short the wait.
 *  - the same snapshot on every animation frame, for what changes without
 *    touching the DOM.
 *
 * Installed before the page loads, but only `armed` once the check is about to
 * press the button, because the focus before that is not under test.
 */
const trackFocus = () => {
  const track = { armed: false, ins: 0, events: [], rests: [], restCount: 0, gaps: [], outAt: null, outBy: '', frames: 0 }
  window.__focus = track
  const name = (el) =>
    !el ? 'nothing' : el === document.body ? 'body' : `${el.tagName.toLowerCase()}${el.getAttribute('role') ? `[${el.getAttribute('role')}]` : ''}`
  const now = () => Math.round(performance.now() * 10) / 10
  const snap = (why) => {
    if (!track.armed || document.activeElement !== document.body) return
    track.restCount += 1
    if (track.rests.length < 3) track.rests.push(`${why} @${now()}ms`)
  }
  document.addEventListener(
    'focusin',
    (event) => {
      track.ins += 1
      if (!track.armed) return
      track.events.push(`${now()}ms focusin ${name(event.target)}`)
      if (track.outAt !== null) {
        track.gaps.push(`${track.outBy} -> ${name(event.target)} after ${(performance.now() - track.outAt).toFixed(1)}ms`)
        track.outAt = null
      }
    },
    true,
  )
  document.addEventListener(
    'focusout',
    (event) => {
      if (!track.armed) return
      track.events.push(`${now()}ms focusout ${name(event.target)} -> ${name(event.relatedTarget)}`)
      const pressed = (event.target.textContent ?? '').includes('Play the comparison')
      if (event.relatedTarget === null && !pressed) {
        track.outAt = performance.now()
        track.outBy = name(event.target)
      }
    },
    true,
  )
  new MutationObserver(() => snap('after a DOM change')).observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['tabindex', 'disabled'],
  })
  const frame = () => {
    if (track.armed) track.frames += 1
    snap('on a frame')
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}

/** What trackFocus saw, as plain data. `stuck` is a focus that went nowhere and has not come back. */
const readFocus = (page) =>
  page.evaluate(() => {
    const t = window.__focus
    const el = document.activeElement
    return {
      ins: t.ins,
      frames: t.frames,
      events: t.events,
      rests: t.rests,
      restCount: t.restCount,
      gaps: t.gaps,
      stuck: t.outAt !== null,
      onBody: el === document.body,
      onChecked: Boolean(el?.matches('#proof [role="radio"][aria-checked="true"]')),
      onGroup: el?.getAttribute('role') === 'radiogroup',
      inAlert: Boolean(el?.closest('#proof [role="alert"]')),
      at: el ? `${el.tagName.toLowerCase()}${el.getAttribute('role') ? `[${el.getAttribute('role')}]` : ''}` : 'none',
      gone: ![...document.querySelectorAll('#proof button')].some((x) => x.textContent?.includes('Play the comparison')),
    }
  })

/**
 * A visitor on a metered link, in a browser set up the way the check needs.
 *
 *  ready    the throttle is up before they press anything
 *  pending  registering the service worker is held back, so the throttle is
 *           still starting when they press and its options cannot be pressed
 *  bare     there is no service worker API at all, so it can never start
 */
async function meteredVisitor(mode, { width = 390, height = 844, reducedMotion = 'no-preference' } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion })
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      get: () => ({ saveData: true, effectiveType: '4g' }),
    })
  })
  if (mode === 'pending') {
    await context.addInitScript(() => {
      const register = ServiceWorkerContainer.prototype.register
      ServiceWorkerContainer.prototype.register = function (...args) {
        return new Promise((done) => setTimeout(done, 6000)).then(() => register.apply(this, args))
      }
    })
  }
  if (mode === 'bare') {
    await context.addInitScript(() => {
      delete Navigator.prototype.serviceWorker
    })
  }
  await context.addInitScript(trackFocus)
  const page = await context.newPage()
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  return { context, page }
}

/** Focus the consent button, check it has it, and press Enter with the watcher armed. */
async function pressConsent(page, label) {
  const consent = page.locator('#proof button', { hasText: 'Play the comparison' })
  await consent.waitFor({ timeout: 30_000 })
  // The button is in the server's HTML, and a key pressed before React has
  // attached to it is dropped. React leaves a `__reactProps$` key on an element
  // it has taken over, which nothing else does.
  await page.waitForFunction(
    () => {
      const button = [...document.querySelectorAll('#proof button')].find((x) => x.textContent?.includes('Play the comparison'))
      return Boolean(button) && Object.keys(button).some((key) => key.startsWith('__reactProps$'))
    },
    null,
    { timeout: 30_000 },
  )
  check(`React has taken over the consent button before it is pressed (${label})`, await consent.evaluate((el) => Object.keys(el).some((key) => key.startsWith('__reactProps$'))))
  await consent.focus()
  check(`the consent button holds focus before it is pressed (${label})`, await consent.evaluate((el) => el === document.activeElement))
  await page.evaluate(() => {
    window.__focus.armed = true
  })
  await page.keyboard.press('Enter')
}

/** Whether every radio is disabled, which is what "the throttle is still starting" looks like. */
const radiosDisabled = (page) =>
  page.evaluate(() => {
    const radios = [...document.querySelectorAll('#proof [role="radio"]')]
    return radios.length > 0 && radios.every((r) => r.disabled)
  })

/** The first few times the body held focus, and how many there were in all. */
const restsOf = (seen) => `${seen.restCount} times on body: ${seen.rests.join('; ')}`

/** The assertions every keyboard press owes, whatever the throttle does. */
function checkFocusKept(seen, label, endsWell, endsAt) {
  check(`the watcher was running (${label})`, seen.events.length >= 1 && seen.frames >= 3 && seen.gone, `${seen.events.length} events, ${seen.frames} frames`)
  check(`focus never rests on the page body (${label})`, seen.restCount === 0, restsOf(seen))
  check(`and none is dropped between one holder and the next (${label})`, seen.gaps.length === 0 && !seen.stuck, seen.gaps.join('; '))
  check(`and it ends ${endsAt} (${label})`, endsWell, `focus is on ${seen.at}`)
}

/*
 * Both directions are checked, and the ordinary one first: the page must take
 * nothing from a visitor who did not ask to be spared the download.
 */
{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      get: () => ({ saveData: false, effectiveType: '4g' }),
    })
  })
  await context.addInitScript(trackFocus)
  const ordinary = await context.newPage()
  let videoBytes = 0
  ordinary.on('response', (res) => {
    if ((res.headers()['content-type'] ?? '').startsWith('video/')) {
      videoBytes += Number(res.headers()['content-length'] ?? 0)
    }
  })
  await ordinary.goto(BASE, { waitUntil: 'domcontentloaded' })
  await ordinary.waitForSelector('#proof [role="radio"]:not([disabled])', { timeout: 30_000 })
  await ordinary.waitForTimeout(6000)
  const seen = await readFocus(ordinary)
  const loading = await ordinary.evaluate(() => [...document.querySelectorAll('#proof video')].filter((v) => v.currentSrc).length)
  check('an ordinary visitor has no consent button to press', seen.gone)
  check('and no focus was taken from them or given to them, on load or when it was ready', seen.ins === 0 && seen.onBody, `${seen.ins} focus events, focus is on ${seen.at}`)
  check('an ordinary link is not held back', loading === 2 && videoBytes > 0, `${loading} players, ${(videoBytes / 1048576).toFixed(1)} MB`)
  await context.close()
}

/*
 * Pressing the button removes it, so focus has to be handed to something that
 * is still there; left to itself it falls to <body> and a keyboard or screen
 * reader user is thrown back to the top of the page.
 */
{
  const { context, page } = await meteredVisitor('ready')
  let videoBytes = 0
  page.on('response', (res) => {
    if ((res.headers()['content-type'] ?? '').startsWith('video/')) {
      videoBytes += Number(res.headers()['content-length'] ?? 0)
    }
  })
  await page.waitForTimeout(6000)
  const state = await page.evaluate(() => ({
    loading: [...document.querySelectorAll('#proof video')].filter((v) => v.currentSrc).length,
    saysCost: (document.querySelector('#proof')?.textContent ?? '').includes('6 MB'),
  }))
  check('a metered link downloads nothing until asked', state.loading === 0 && videoBytes === 0, `${state.loading} players, ${videoBytes} bytes`)
  check('and it says what pressing the button will cost', state.saysCost)
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 30_000 })
  check('the throttle was up before the button was pressed', await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
  await pressConsent(page, 'throttle ready')
  await page.waitForSelector('#proof [role="radio"][aria-checked="true"]:not([disabled])', { timeout: 30_000 })
  await page.waitForTimeout(500)
  const seen = await readFocus(page)
  checkFocusKept(seen, 'throttle ready', seen.onChecked, 'on the chosen connection option')
  await page.waitForTimeout(5500)
  const started = await page.evaluate(() => [...document.querySelectorAll('#proof video')].filter((v) => v.currentSrc).length)
  check('pressing it runs the comparison', started === 2, `${started} players`)
  await context.close()
}

/*
 * The same press while the throttle is still starting. The options are
 * disabled and cannot hold focus, so the group does until they can and then
 * hands it on. This is the path the run above never reaches, its six-second
 * wait having let the worker finish first.
 */
{
  const { context, page } = await meteredVisitor('pending')
  await pressConsent(page, 'throttle starting')
  await page.waitForTimeout(300)
  const starting = await readFocus(page)
  check('the throttle was really still starting when the button was pressed', await radiosDisabled(page))
  check('while it starts, the group holds focus', starting.onGroup, `focus is on ${starting.at}`)
  check('and the page body has not had it meanwhile', starting.restCount === 0 && starting.gaps.length === 0, `${restsOf(starting)} ${starting.gaps.join('; ')}`)
  await page.waitForSelector('#proof [role="radio"]:not([disabled])', { timeout: 30_000 })
  await page.waitForTimeout(500)
  const seen = await readFocus(page)
  checkFocusKept(seen, 'throttle starting', seen.onChecked, 'on the chosen connection option once it is ready')
  await context.close()
}

/*
 * A visitor who scrolls away while it starts is not pulled back to the controls
 * when it is ready. Moving focus there would scroll to it - 1300 to 1450px on
 * a phone and on a desktop - from wherever they have got to.
 *
 * Run as a visitor with no restriction (normal motion) and one with reduced
 * motion, on a phone and a desktop width, because the section lays itself out
 * differently in each. Scrolled three ways: straight to the end, which raises
 * no input event of its own, as dragging a scrollbar does; by the wheel; and by
 * the End key from the group that holds focus.
 */
for (const [width, height, reducedMotion, how] of [
  [390, 844, 'no-preference', 'scrollTo'],
  [390, 844, 'reduce', 'scrollTo'],
  [1440, 900, 'no-preference', 'scrollTo'],
  [1440, 900, 'reduce', 'scrollTo'],
  [390, 844, 'no-preference', 'wheel'],
  [390, 844, 'no-preference', 'End key'],
]) {
  const label = `${width}px, ${reducedMotion === 'reduce' ? 'reduced motion' : 'normal motion'}, ${how}`
  const { context, page } = await meteredVisitor('pending', { width, height, reducedMotion })
  check(
    `the visitor's motion setting took effect (${label})`,
    await page.evaluate((r) => matchMedia(`(prefers-reduced-motion: ${r})`).matches, reducedMotion),
  )
  await pressConsent(page, label)
  await page.waitForTimeout(300)
  check(`the throttle was really still starting (${label})`, await radiosDisabled(page))
  if (how === 'scrollTo') {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  } else if (how === 'wheel') {
    await page.mouse.move(width / 2, height / 2)
    await page.mouse.wheel(0, 100_000)
  } else {
    await page.keyboard.press('End')
  }
  await page.waitForTimeout(600)
  const away = await page.evaluate(() => Math.round(window.scrollY))
  check(`the page really did scroll away (${label})`, away > 400, `y ${away}`)
  await page.waitForSelector('#proof [role="radio"]:not([disabled])', { timeout: 30_000 })
  await page.waitForTimeout(800)
  const after = await page.evaluate(() => Math.round(window.scrollY))
  check(`and ready does not jump the page back to the controls (${label})`, Math.abs(after - away) <= 2, `y ${away} then ${after}, moved ${Math.abs(after - away)}px`)
  // Not pulled to the radio, and not dropped either: still on the group that held it.
  const kept = await readFocus(page)
  check(`and focus stays where it was, on the group (${label})`, kept.onGroup && kept.restCount === 0, `focus is on ${kept.at}, ${restsOf(kept)}`)
  await context.close()
}

/*
 * The same press when the connection cannot be throttled at all.
 *
 * With no service worker API the page shows an alert instead of the controls,
 * so the pressed button's replacement is the alert, and that is where focus
 * must go.
 */
{
  const { context, page } = await meteredVisitor('bare')
  check('the service worker API is really absent for this check', await page.evaluate(() => !('serviceWorker' in navigator)))
  await pressConsent(page, 'no service worker')
  await page.waitForSelector('#proof p[role="alert"]', { timeout: 30_000 })
  await page.waitForTimeout(500)
  const seen = await readFocus(page)
  checkFocusKept(seen, 'no service worker', seen.inAlert, 'on the alert that explains why')
  await context.close()
}

/*
 * The pinned comparison fits the screen it pins to, in both modes.
 *
 * The section holds itself to the viewport for a whole screen of scrolling and
 * cuts off whatever does not fit. A column sized for one mode silently lost the
 * other's last lines: at 1366x768 the Slow 2G verdict was cut in half while
 * Normal fitted with room to spare, and nothing in this suite looked at Slow
 * 2G's layout at all. Measured at rest and at the top of the section, where the
 * stage has not settled and sits lower. Below the pinning height the section is
 * meant to stop pinning, so there the check is that it did.
 */
for (const [width, height] of [[1366, 768], [1024, 768], [1366, 633]]) {
  for (const reducedMotion of ['reduce', 'no-preference']) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion })
    const fit = await context.newPage()
    await fit.goto(BASE, { waitUntil: 'domcontentloaded' })
    await fit.waitForSelector('#proof [role="radio"]', { timeout: 30_000 })
    for (const label of ['Normal', 'Slow 2G']) {
      await fit.locator('#proof [role="radio"]', { hasText: label }).click()
      await fit.waitForTimeout(500)
      const measured = await fit.evaluate(() => {
        const box = document.querySelector('#proof > div')
        const stage = document.querySelector('#proof [data-stage="proof"]')
        return {
          pinned: getComputedStyle(box).position === 'sticky',
          spare: Math.round(box.getBoundingClientRect().bottom - stage.lastElementChild.getBoundingClientRect().bottom),
        }
      })
      const where = `${width}x${height}, ${label}, ${reducedMotion === 'reduce' ? 'settled' : 'not yet settled'}`
      if (height >= 740) {
        check(`the pinned comparison fits the screen (${where})`, measured.pinned && measured.spare >= 0, `${measured.spare}px spare`)
      } else {
        check(`a screen too short to pin it scrolls instead (${where})`, !measured.pinned, measured.pinned ? `pinned, ${measured.spare}px spare` : 'not pinned')
      }
    }
    await context.close()
  }
}

check('no uncaught errors', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '))

await browser.close()

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed:\n  ${failures.join('\n  ')}`)
  process.exit(1)
}
console.log('\nproof: all checks passed')
