/**
 * Exercises the player through the development harness the way a person would:
 * press play, drag the bar, use the keyboard, open the menu, switch quality,
 * turn subtitles on.
 */
import { chromium, devices } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://localhost:5173'
const V = '[data-case="ladder"] video.xp-video'
const failures = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures.push(name)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(String(e.message)))

const state = () =>
  page.evaluate((sel) => {
    const v = document.querySelector(sel)
    return v
      ? {
          paused: v.paused,
          t: +v.currentTime.toFixed(2),
          dur: Number.isFinite(v.duration) ? Math.round(v.duration) : null,
          ready: v.readyState,
          rate: v.playbackRate,
          muted: v.muted,
          err: v.error?.code ?? null,
        }
      : null
  }, V)

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.locator('#ladder').scrollIntoViewIfNeeded()
await page.waitForTimeout(1500)

check('player mounted', (await page.locator('[data-case="ladder"] .xp-root').count()) === 1)
const meta = await state()
check('metadata loaded', meta.dur !== null && meta.err === null, JSON.stringify(meta))

/* ------------------------------------------------------------- playback */

await page.locator('[data-case="ladder"] .xp-bigplay').click()
await page.waitForTimeout(2500)
const playing = await state()
check('plays', !playing.paused && playing.t > 0.5, JSON.stringify(playing))

/*
 * The play button removes itself the moment playback starts, and focus went
 * with it - to the document body, where none of the shortcuts are listening.
 * Every key was dead from then on for anyone who started a video the obvious
 * way, which is why the 5-second skip looked unreliable rather than broken:
 * click the picture and it worked, press the button and it did not.
 *
 * This has to be checked here, before the keyboard section below focuses the
 * player by hand. That call is exactly what hid this for so long.
 */
check(
  'the keyboard survives the play button removing itself',
  await page.evaluate(() => {
    const root = document.querySelector('[data-case="ladder"] .xp-root')
    return document.activeElement !== document.body && root.contains(document.activeElement)
  }),
)

const beforeSkip = (await state()).t
await page.keyboard.press('ArrowRight')
await page.waitForTimeout(500)
const afterSkip = (await state()).t
check(
  'the 5s skip works without focusing the player by hand',
  afterSkip - beforeSkip > 3.5 && afterSkip - beforeSkip < 6.5,
  `${beforeSkip} -> ${afterSkip}`,
)

/* Put it back where it was: the checks below start from here. */
await page.evaluate(
  ([sel, t]) => {
    document.querySelector(sel).currentTime = t
  },
  [V, beforeSkip],
)
await page.waitForTimeout(300)

check(
  'progress bar is painted directly to the DOM',
  await page.evaluate(() => {
    const el = document.querySelector('[data-case="ladder"] .xp-seek-played')
    return !!el && /scaleX\(0?\.[0-9]/.test(el.style.transform)
  }),
)

/* ------------------------------------------------------------- keyboard */

await page.locator('[data-case="ladder"] .xp-root').focus()
const before = (await state()).t
await page.keyboard.press('l')
await page.waitForTimeout(500)
const after = (await state()).t
check('L skips forward 10s', after - before > 8 && after - before < 12, `${before} -> ${after}`)

await page.keyboard.press(' ')
await page.waitForTimeout(400)
check('space pauses', (await state()).paused)

await page.keyboard.press('m')
await page.waitForTimeout(300)
check('M mutes', (await state()).muted)
await page.keyboard.press('m')

/* ---------------------------------------------------------------- seek */

const bar = await page.locator('[data-case="ladder"] .xp-seek').boundingBox()
await page.mouse.move(bar.x + bar.width * 0.1, bar.y + bar.height / 2)
await page.mouse.down()
await page.mouse.move(bar.x + bar.width * 0.6, bar.y + bar.height / 2, { steps: 12 })
await page.mouse.up()
await page.waitForTimeout(700)
const scrubbed = await state()
check('dragging seeks to roughly 60%', scrubbed.t / scrubbed.dur > 0.45 && scrubbed.t / scrubbed.dur < 0.75, `${scrubbed.t}/${scrubbed.dur}`)

/*
 * The playhead sits where the played bar ends, at every position.
 *
 * Both are drawn by the same loop from the same ratio, but they are drawn to
 * different elements by different means - the bar with scaleX on the track,
 * the playhead with translateX on a layer stretched across it. That layer is
 * why the check exists: the position is no longer a percentage of the thing it
 * appears to sit on, so anything that changes the layer's box - a padding on
 * .xp-seek, an inset, a width that stops matching the track - moves the dot
 * away from the bar without breaking either of them on its own. Nothing else
 * here would notice, because seeking would still work and the bar would still
 * paint.
 *
 * Measured against the played bar rather than against an expected pixel, so it
 * stays true at any player width.
 */
const playheadDrift = await page.evaluate(async (sel) => {
  const root = document.querySelector(sel)
  const video = root.querySelector('video.xp-video')
  const worst = []
  for (const ratio of [0, 0.25, 0.5, 0.75, 1]) {
    await new Promise((done) => {
      video.addEventListener('seeked', done, { once: true })
      video.currentTime = video.duration * ratio
    })
    await new Promise((done) => setTimeout(done, 200))
    const seek = root.querySelector('.xp-seek').getBoundingClientRect()
    const played = root.querySelector('.xp-seek-played').getBoundingClientRect()
    const handle = root.querySelector('.xp-seek-handle').getBoundingClientRect()
    worst.push({ ratio, off: +(handle.left - played.right).toFixed(1), width: Math.round(seek.width) })
  }
  return worst
}, '[data-case="ladder"]')
check(
  'the playhead lands where the played bar ends, at every position',
  playheadDrift.every((p) => Math.abs(p.off) <= 1),
  playheadDrift.map((p) => `${p.ratio}:${p.off}px`).join(' '),
)

/*
 * The slider keeps telling the truth after the controls fade.
 *
 * Hiding the controls is `opacity: 0`, so the seek bar stays in the
 * accessibility tree with a live role="slider" and a value a screen reader can
 * read at any time. The painter stops running every frame once the controls go
 * - deliberately, it is sixty writes a second nobody can see - and stopping it
 * outright also froze aria-valuenow: measured at 2.9 seconds of drift, the
 * slider announcing "2 seconds" over a video at 4.9.
 *
 * The gap only ever reached a reader browsing the page without focusing the
 * bar, because focusing it shows the controls and corrects the value on the
 * way in. That is what made it worth a check rather than a shrug: the one
 * caller who could be told something stale is the one with no way to see that
 * it was.
 *
 * Its own page, played and then left alone, because every other check here
 * keeps the pointer busy and the controls up - which is exactly the state this
 * does not test. The suite passed the regression that introduced this.
 */
const ariaPage = await browser.newPage({ viewport: { width: 1200, height: 800 } })
await ariaPage.goto(BASE, { waitUntil: 'networkidle' })
await ariaPage.locator('#ladder').scrollIntoViewIfNeeded()
await ariaPage.waitForTimeout(1200)
await ariaPage.evaluate((sel) => {
  const video = document.querySelector(`${sel} video.xp-video`)
  video.muted = true
  video.loop = true
  return video.play().catch(() => {})
}, '[data-case="ladder"]')
/* Out of the player, so the controls time out the way they would for a viewer. */
await ariaPage.mouse.move(5, 5)
await ariaPage.waitForFunction(
  (sel) => !document.querySelector(`${sel} .xp-root`).classList.contains('xp-show'),
  '[data-case="ladder"]',
  { timeout: 15_000 },
)
/* Long enough that a frozen value is unmistakable: the bug drifted by the wait. */
await ariaPage.waitForTimeout(6000)
const spoken = await ariaPage.evaluate((sel) => {
  const root = document.querySelector(`${sel} .xp-root`)
  const video = root.querySelector('video.xp-video')
  const slider = root.querySelector('.xp-seek')
  return {
    hidden: !root.classList.contains('xp-show'),
    playing: !video.paused,
    drift: +(video.currentTime - Number(slider.getAttribute('aria-valuenow'))).toFixed(1),
    text: slider.getAttribute('aria-valuetext'),
  }
}, '[data-case="ladder"]')
check(
  'the bar is genuinely hidden and playing while this is measured',
  spoken.hidden && spoken.playing,
  JSON.stringify(spoken),
)
/*
 * Two seconds, not one. The slow tick is 1 Hz and drawRatio floors the second
 * on purpose - the visible clock floors, and rounding the spoken value on top
 * of that made the number say 1 while the words beside it said "0 seconds".
 * So a second of lag is the design; six would be the bug.
 */
check(
  'the spoken position keeps up while the controls are hidden',
  spoken.drift <= 2,
  `${spoken.drift}s behind, reading "${spoken.text}"`,
)
await ariaPage.close()

/* ------------------------------------------------------- frame preview */

/*
 * The frame is drawn from a second, hidden copy of the video, so the check
 * that matters is not that a canvas exists but that what is on it is the
 * video at that moment. Compared against the real element seeked to the same
 * time: a blank canvas, a stale frame or the wrong second all fail it. The lit
 * check is not redundant - without it, a canvas that was never drawn and a
 * scene that happens to be black would agree perfectly.
 */
await page.mouse.move(bar.x + bar.width * 0.75, bar.y + bar.height / 2)
await page.waitForTimeout(1200)
const preview = await page.evaluate(async (sel) => {
  const canvas = document.querySelector(`${sel} .xp-seek-frame`)
  if (!canvas || canvas.hidden || !canvas.width) return null
  const video = document.querySelector(`${sel} video.xp-video`)
  const scratch = document.createElement("canvas")
  scratch.width = canvas.width
  scratch.height = canvas.height
  await new Promise((done) => {
    video.addEventListener("seeked", done, { once: true })
    video.currentTime = video.duration * 0.75
  })
  await new Promise((done) => setTimeout(done, 300))
  scratch.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height)
  const want = scratch.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data
  const got = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data
  let diff = 0
  let lit = 0
  for (let p = 0; p < want.length; p += 4) {
    diff += (Math.abs(want[p] - got[p]) + Math.abs(want[p + 1] - got[p + 1]) + Math.abs(want[p + 2] - got[p + 2])) / 3
    if (got[p] + got[p + 1] + got[p + 2] > 30) lit += 1
  }
  return { diff: diff / (want.length / 4), litPct: (lit / (want.length / 4)) * 100 }
}, "[data-case=\"ladder\"]")

check('hovering the bar draws the frame under the pointer', preview !== null && preview.litPct > 5, JSON.stringify(preview))
check(
  'the drawn frame is the video at that time',
  preview !== null && preview.diff < 60,
  preview && `mean channel difference ${preview.diff.toFixed(1)}`,
)

/* ---------------------------------------------------------------- menu */

await page.locator('[data-case="ladder"] .xp-root').hover()
await page.locator('[data-case="ladder"] .xp-settings .xp-btn').click()
await page.waitForTimeout(300)
check('settings menu opens', (await page.locator('[data-case="ladder"] .xp-menu').count()) > 0)
await page.locator('[data-case="ladder"] .xp-menu-item', { hasText: 'Playback speed' }).click()
await page.waitForTimeout(250)
await page.locator('[data-case="ladder"] .xp-menu-option', { hasText: '1.5x' }).click()
await page.waitForTimeout(300)
check('speed changes to 1.5x', (await state()).rate === 1.5)
await page.keyboard.press('Escape')

/* ------------------------------------------ controls vs. keyboard focus */

/*
 * The order here is the bug: focusing clears the hide timer, and the pointer
 * move that follows re-arms it. Guarding only the pointerleave handler left
 * that timer free to hide a focused control 2.5s later, so the pointer never
 * has to leave the player for this to fail.
 */
const SHOWING = '[data-case="ladder"] .xp-root.xp-show'
const rootBox = await page.locator('[data-case="ladder"] .xp-root').boundingBox()
const nudge = async () => {
  await page.mouse.move(rootBox.x + rootBox.width / 2, rootBox.y + rootBox.height / 2)
  await page.mouse.move(rootBox.x + rootBox.width / 2 + 4, rootBox.y + rootBox.height / 2)
}

// A paused player keeps its controls up for an unrelated reason, which would
// make both checks below pass without proving anything. Rewind as well: the
// clip runs 14s, and the two waits below would otherwise reach the end of it
// and pause for that reason instead.
await page.evaluate((sel) => {
  const v = document.querySelector(sel)
  v.currentTime = 0
  return v.play()
}, V)
await page.waitForTimeout(500)

// Proves the hide timer is running here at all, so the check after it cannot
// pass by accident.
await page.evaluate(() => document.activeElement?.blur())
await nudge()
await page.waitForTimeout(3200)
check('controls fade out with nothing focused', (await page.locator(SHOWING).count()) === 0)

await page.locator('[data-case="ladder"] .xp-settings .xp-btn').focus()
await nudge()
await page.waitForTimeout(3200)
check('controls stay up while a control has focus', (await page.locator(SHOWING).count()) === 1)
await page.evaluate(() => document.activeElement?.blur())

/* ----------------------------------------------------------- subtitles */

await page.locator('[data-case="ladder"] .xp-root').focus()
await page.keyboard.press('c')
await page.waitForTimeout(500)
const cue = await page.evaluate((sel) => {
  const v = document.querySelector(sel)
  const t = Array.from(v.textTracks).find((tt) => tt.mode === 'showing')
  return t ? t.label : null
}, V)
check('C turns subtitles on', cue !== null, cue ?? '(none)')

/* --------------------------------------------- progressive quality ladder */

// Quality has its own button on the bar: reaching it must take one click, not a
// trip through the settings menu.
await page.keyboard.press('Escape')
await page.locator('[data-case="ladder"] .xp-root').hover()
const qualityBtn = page.locator('[data-case="ladder"] .xp-quality .xp-btn-text')
check('quality has its own button on the bar', (await qualityBtn.count()) === 1)
check('the button names the current rendition', (await qualityBtn.textContent())?.includes('480p'), await qualityBtn.textContent())

await qualityBtn.click()
await page.waitForTimeout(300)
const ladder = await page.locator('[data-case="ladder"] .xp-quality .xp-menu-option').allTextContents()
check('one click lists every encode supplied', ladder.length === 3, ladder.join(', '))

// Pause and seek first: then nothing but the switch itself can move the position.
await page.evaluate((sel) => {
  const v = document.querySelector(sel)
  v.pause()
  v.currentTime = 7
}, V)
await page.waitForTimeout(500)
const beforeSwitch = await state()
await page.locator('[data-case="ladder"] .xp-quality .xp-menu-option', { hasText: '240p' }).click()
await page.waitForTimeout(2500)
const afterSwitch = await state()
const switchedFile = await page.evaluate((sel) => document.querySelector(sel).currentSrc.includes('240p'), V)
check('switching quality loads the other file', switchedFile)
check(
  'switching quality keeps your place',
  Math.abs(afterSwitch.t - beforeSwitch.t) < 0.8,
  `${beforeSwitch.t} -> ${afterSwitch.t}`,
)
check('the button follows the switch', (await qualityBtn.textContent())?.includes('240p'), await qualityBtn.textContent())

// Subtitles belong to the video, not the rendition, so they must survive it.
await page.locator('[data-case="ladder"] .xp-settings .xp-btn').click()
await page.waitForTimeout(300)
/*
 * Visible rows only. Quality now has a row here for narrow players, hidden by
 * a container query on a wide one - and allTextContents() reads hidden text
 * happily, so a presence check would report a duplicate that no viewer of this
 * player can see.
 */
const settingsRows = await page.evaluate(() =>
  [...document.querySelectorAll('[data-case="ladder"] .xp-settings .xp-menu-item')]
    .filter((el) => el.getBoundingClientRect().width > 0)
    .map((el) => el.textContent.trim()),
)
check('subtitles survive a quality switch', settingsRows.some((r) => r.startsWith('Subtitles')), settingsRows.join(' | '))
check('quality is not duplicated in settings', !settingsRows.some((r) => r.startsWith('Quality')), settingsRows.join(' | '))
await page.keyboard.press('Escape')

/* ----------------------------------------------------------------- HLS */

const HLS = '[data-case="hls"]'
await page.locator(HLS).scrollIntoViewIfNeeded()
await page.waitForTimeout(7000)
const hls = await page.evaluate((sel) => {
  const v = document.querySelector(sel)
  return { dur: Number.isFinite(v.duration) ? Math.round(v.duration) : null, err: v.error?.code ?? null }
}, `${HLS} video.xp-video`)
check('HLS stream loads', hls.dur !== null && hls.err === null, JSON.stringify(hls))
await page.locator(`${HLS} .xp-root`).hover()
const hlsQuality = page.locator(`${HLS} .xp-quality .xp-btn-text`)
check('the same button serves HLS', (await hlsQuality.count()) === 1)
await hlsQuality.click()
await page.waitForTimeout(400)
const levels = await page.locator(`${HLS} .xp-quality .xp-menu-option`).allTextContents()
check('stream renditions are listed', levels.length > 2, levels.join(', '))
check('automatic is offered first', levels[0].startsWith('Auto'), levels[0])

/*
 * A stream opts out of frame previews. Drawing them would mean a second
 * hls.js and a second buffer for a thumbnail, which costs more than the
 * feature is worth. The time must still be there: opting out of the picture
 * is not opting out of the tooltip.
 */
await page.keyboard.press('Escape')
const hlsBar = await page.locator(`${HLS} .xp-seek`).boundingBox()
await page.mouse.move(hlsBar.x + hlsBar.width * 0.5, hlsBar.y + hlsBar.height / 2)
await page.waitForTimeout(1000)
const streamTip = await page.evaluate((sel) => {
  const root = document.querySelector(sel)
  const tip = root.querySelector('.xp-seek-tip')
  return {
    frame: !!root.querySelector('.xp-seek-frame'),
    time: tip && getComputedStyle(tip).display !== 'none' ? tip.textContent.trim() : null,
  }
}, HLS)
check('a stream draws no frame preview', streamTip.frame === false, JSON.stringify(streamTip))
check('a stream still shows the time under the pointer', /^[0-9]+:[0-9][0-9]/.test(streamTip.time ?? ''), streamTip.time)

/*
 * The time alone is a much narrower tooltip than the frame - 40 to 46px here
 * against 170 - so a clamp written for one width is wrong for the other. The
 * frame is checked further down, beside tipInside.
 */
const streamEdges = []
for (const frac of [0.003, 0.997]) {
  const x = hlsBar.x + hlsBar.width * frac
  await page.mouse.move(x, hlsBar.y + hlsBar.height / 2)
  await page.waitForTimeout(300)
  streamEdges.push(
    await page.evaluate(
      ([sel, px]) => {
        const seek = document.querySelector(sel + ' .xp-seek').getBoundingClientRect()
        const tip = document.querySelector(sel + ' .xp-seek-tip').getBoundingClientRect()
        return {
          w: Math.round(tip.width),
          left: Math.round(tip.left - seek.left),
          right: Math.round(seek.right - tip.right),
          // How far the tooltip had to move off the pointer to stay in.
          off: Math.round(tip.left + tip.width / 2 - px),
        }
      },
      [HLS, x],
    ),
  )
}
check(
  'the time-only tooltip stays inside the bar at both ends',
  streamEdges.every((e) => e.w > 0 && e.left >= -1 && e.right >= -1),
  JSON.stringify(streamEdges),
)
check(
  'without being pushed further in than it needs',
  streamEdges[0].left <= 2 && streamEdges[1].right <= 2,
  JSON.stringify(streamEdges),
)

/* ------------------------------------------------------- single source */

// With one file there is nothing to choose between, so the control must not
// appear at all rather than showing a list of one.
await page.locator('[data-case="single"]').scrollIntoViewIfNeeded()
await page.waitForTimeout(800)
await page.locator('[data-case="single"] .xp-root').hover()
check(
  'a single source shows no quality button',
  (await page.locator('[data-case="single"] .xp-quality').count()) === 0,
)

const LADDER_CASE = '[data-case="ladder"]'

/* --------------------------------------------- the panels that block play */

/*
 * The error and the resume offer have to fit the player they are blocking.
 *
 * Both were drawn for a player with room to spare, and neither could be
 * answered on a small one: in a 159x89 box the error panel came out 203px
 * tall so Try again fell outside a root that is overflow: hidden, and the
 * offer ran 58px past the right edge taking Start over with it. Every button
 * in them was also 18 or 19 pixels tall, at every width.
 *
 * The markup is injected rather than provoked. An error needs a failure and
 * the offer needs a saved position longer than the demo clip, and what is
 * under test here is the stylesheet either way - these are the panels a
 * viewer meets when something has already gone wrong, so being unable to
 * answer them is the worst place for it.
 */
const ERROR_MARKUP =
  '<div class="xp-error" role="alert"><svg width="24" height="24"></svg>' +
  '<p class="xp-error-text">Connection lost. Check your internet and try again.</p>' +
  '<button type="button" class="xp-error-retry">Try again</button></div>'
const RESUME_MARKUP =
  '<span>Resume from <strong>1:23</strong>?</span>' +
  '<button type="button" class="xp-resume-primary">Resume</button>' +
  '<button type="button" class="xp-resume-ghost">Start over</button>'

/* elementFromPoint speaks viewport coordinates, so the player has to be in it. */
await page.locator('#ladder').scrollIntoViewIfNeeded()
await page.waitForTimeout(400)

const unreachable = []
const tooSmall = []
for (const width of [640, 400, 342, 300, 250, 220, 200, 159]) {
  for (const kind of ["error", "resume"]) {
    const found = await page.evaluate(
      ([sel, w, which, errorHtml, resumeHtml]) => {
        const root = document.querySelector(sel + " .xp-root")
        root.parentElement.style.width = w + "px"
        root.querySelectorAll(".xp-probe").forEach((n) => n.remove())
        const panel = document.createElement("div")
        if (which === "error") {
          panel.className = "xp-center xp-center-blocking xp-center-error xp-probe"
          panel.innerHTML = errorHtml
        } else {
          panel.className = "xp-resume xp-probe"
          panel.innerHTML = resumeHtml
        }
        root.appendChild(panel)
        const box = root.getBoundingClientRect()
        return [...root.querySelectorAll(".xp-probe button")].map((button) => {
          const r = button.getBoundingClientRect()
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
          return {
            name: button.textContent.trim(),
            inside:
              r.left >= box.left - 1 &&
              r.right <= box.right + 1 &&
              r.top >= box.top - 1 &&
              r.bottom <= box.bottom + 1,
            hittable: hit === button || button.contains(hit),
            h: Math.round(r.height),
          }
        })
      },
      [LADDER_CASE, width, kind, ERROR_MARKUP, RESUME_MARKUP],
    )
    for (const button of found) {
      if (!button.inside || !button.hittable) unreachable.push(width + "px " + button.name)
      if (button.h < 44) tooSmall.push(width + "px " + button.name + " " + button.h + "px")
    }
  }
}
await page.evaluate((sel) => {
  document.querySelectorAll(sel + " .xp-probe").forEach((n) => n.remove())
}, LADDER_CASE)

check(
  'every button in a blocking panel can be reached at every width',
  unreachable.length === 0,
  unreachable.slice(0, 6).join(', '),
)
check(
  'and is big enough to hit',
  tooSmall.length === 0,
  tooSmall.slice(0, 6).join(', '),
)

/* ---------------------------------------- a menu over the panels that block */

/*
 * A menu opened while a blocking panel is up takes its own clicks.
 *
 * The menu renders inside .xp-controls, at z-index 5, and both the resume
 * offer (8) and the blocking centre layer (7) take pointer events above it. So
 * the rows of an open menu that fell under either panel could not be clicked:
 * reopen a file and go straight to the audio track, or open settings before
 * the first play. The desktop app's playback suite stopped dead on exactly
 * this, trying to pick a quality under the resume offer. The panels are
 * injected as they are above; the menu is the real one, opened by a click.
 */
const menuBlocked = []
let menuRowsSeen = 0
const ladderWidth = await page.evaluate((sel) => document.querySelector(sel + ' .xp-root').parentElement.style.width, LADDER_CASE)
for (const kind of ['resume', 'play']) {
  await page.evaluate(
    ([sel, which, resumeHtml]) => {
      const root = document.querySelector(sel + ' .xp-root')
      root.parentElement.style.width = '640px'
      root.querySelectorAll('.xp-probe').forEach((n) => n.remove())
      const panel = document.createElement('div')
      panel.className = which === 'resume' ? 'xp-resume xp-probe' : 'xp-center xp-center-blocking xp-probe'
      panel.innerHTML = which === 'resume' ? resumeHtml : '<span>blocking</span>'
      root.appendChild(panel)
    },
    [LADDER_CASE, kind, RESUME_MARKUP],
  )
  await page.waitForTimeout(300)
  await page.locator(LADDER_CASE + ' .xp-root').hover()
  await page.locator(LADDER_CASE + ' .xp-settings .xp-btn').click()
  await page.waitForTimeout(300)
  const rows = await page.evaluate(
    (sel) =>
      [...document.querySelectorAll(sel + ' .xp-menu-item')]
        .map((row) => {
          const r = row.getBoundingClientRect()
          // Rows for controls that live on the bar at this width are hidden.
          if (r.width === 0 || r.height === 0) return null
          const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
          return { name: row.textContent.trim(), ok: at === row || row.contains(at) }
        })
        .filter(Boolean),
    LADDER_CASE,
  )
  menuRowsSeen += rows.length
  for (const row of rows) if (!row.ok) menuBlocked.push(kind + ': ' + row.name)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
}
await page.evaluate(
  ([sel, width]) => {
    document.querySelectorAll(sel + ' .xp-probe').forEach((n) => n.remove())
    document.querySelector(sel + ' .xp-root').parentElement.style.width = width
  },
  [LADDER_CASE, ladderWidth],
)

check('a settings menu was opened over each kind of blocking panel', menuRowsSeen > 0, menuRowsSeen + ' visible rows')
check('and every visible row of it can be clicked', menuBlocked.length === 0, menuBlocked.slice(0, 6).join(', '))

/* ------------------------------------- a menu takes the resume offer with it */

/*
 * Opening a menu closes the resume offer.
 *
 * Both want the same band. The offer spans nearly the whole width at the bar's
 * height plus 28px, the menu opens upward from the bar into exactly that, and
 * the offer takes pointer events because it has to - it cannot be answered
 * otherwise. So the rows beneath it did nothing: reopen a file you have watched
 * before and go straight to the audio track or the speed. The desktop app's
 * playback suite stopped dead there, thirty seconds of waiting on a row that
 * `.xp-resume` was intercepting.
 *
 * A viewer who has reached the menu walked past the offer to get there, so the
 * offer is the one that goes, by the same call its own Start over makes - the
 * remembered position must not end up in a third state that nothing else in the
 * player knows about.
 *
 * The offer here is the real one, not markup injected like the probes above:
 * what is under test is React state, which no amount of appended HTML can
 * change. Only the length of the file is faked. A remembered position has to be
 * past 15 seconds and short of 95% of the duration, and the demo clip runs 14 -
 * so the element is told it is ten minutes long and asked to report its
 * metadata again, which is the path a reopened file takes. The single-source
 * case is the one that remembers positions at all; every other case on the
 * harness turns it off.
 *
 * Its own page: a faked duration and a written storage key are exactly the kind
 * of state that must not reach the checks around it.
 */
const SINGLE = '[data-case="single"]'
const SAVED_KEY = 'xp:pos:dev-single' // the storageKey the harness gives that case
const resumePage = await browser.newPage({ viewport: { width: 1200, height: 900 } })
await resumePage.goto(BASE, { waitUntil: 'networkidle' })
await resumePage.locator('#single').scrollIntoViewIfNeeded()
await resumePage.waitForTimeout(1200)
await resumePage.evaluate(
  ([sel, key, at]) => {
    const video = document.querySelector(sel + ' video.xp-video')
    // An own property shadows the prototype's getter; the element is otherwise
    // the real one, still loaded from the real file.
    Object.defineProperty(video, 'duration', { configurable: true, get: () => 600 })
    window.localStorage.setItem(key, String(at))
    video.dispatchEvent(new Event('loadedmetadata'))
  },
  [SINGLE, SAVED_KEY, 83],
)
await resumePage.waitForTimeout(400)
const offered = await resumePage.evaluate((sel) => {
  const card = document.querySelector(sel + ' .xp-resume')
  return card ? card.textContent.trim() : null
}, SINGLE)
check(
  'a file with a remembered position offers to resume from it',
  offered !== null && offered.includes('1:23'),
  offered ?? 'no offer, so nothing below is being tested',
)

await resumePage.locator(SINGLE + ' .xp-root').hover()
await resumePage.locator(SINGLE + ' .xp-settings .xp-btn').click()
await resumePage.waitForTimeout(400)
const withMenu = await resumePage.evaluate(
  ([sel, key]) => {
    const root = document.querySelector(sel + ' .xp-root')
    const rows = [...root.querySelectorAll('.xp-menu .xp-menu-item')].filter(
      (row) => row.getBoundingClientRect().width > 0,
    )
    return {
      offer: !!root.querySelector('.xp-resume'),
      stored: window.localStorage.getItem(key),
      rows: rows.map((row) => {
        const r = row.getBoundingClientRect()
        const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        const mine = at === row || row.contains(at)
        return { name: row.textContent.trim(), under: mine ? null : at?.className?.toString().split(' ')[0] ?? 'nothing' }
      }),
    }
  },
  [SINGLE, SAVED_KEY],
)
check(
  'opening a menu takes the resume offer with it',
  withMenu.rows.length > 0 && withMenu.offer === false,
  `${withMenu.rows.length} row(s) open, offer ${withMenu.offer ? 'still up' : 'gone'}`,
)
/*
 * Dismissed, not erased. Nothing on the card erases the saved position any
 * more: Resume seeks to it and Start over leaves it where it is. Taking the
 * offer away for a menu must leave the stored value as it was.
 */
check(
  'and the position survives, the way it survives Start over',
  withMenu.stored !== null,
  withMenu.stored !== null ? `still saved at ${withMenu.stored}s` : 'erased',
)

/*
 * The offer was one of the three things pinning the controls open, so losing it
 * must not let them fade out from under the menu that is still up. The pointer
 * leaves the player first: hovering it would keep the bar up on its own and this
 * would prove nothing.
 */
await resumePage.mouse.move(5, 5)
await resumePage.waitForTimeout(3200)
const stillUp = await resumePage.evaluate((sel) => {
  const root = document.querySelector(sel + ' .xp-root')
  return { shown: root.classList.contains('xp-show'), menu: !!root.querySelector('.xp-menu') }
}, SINGLE)
check(
  'and the controls stay up with the menu open and the offer gone',
  stillUp.shown && stillUp.menu,
  JSON.stringify(stillUp),
)

/*
 * Clicked for real, with the timeout the app's run hit: elementFromPoint says
 * what is on top, and this says whether the row can be used.
 */
const rowClick = await resumePage
  .locator(SINGLE + ' .xp-menu-item', { hasText: 'Playback speed' })
  .click({ timeout: 5000 })
  .then(() => '')
  .catch((err) => String(err.message).split('\n').find((line) => line.includes('intercepts')) ?? 'click timed out')
await resumePage.waitForTimeout(300)
const speedRows = await resumePage.locator(SINGLE + ' .xp-menu-option', { hasText: '1.5x' }).count()
check(
  'and the row in that band opens the panel it names',
  withMenu.rows.length > 0 && withMenu.rows.every((row) => row.under === null) && rowClick === '' && speedRows > 0,
  rowClick.trim() ||
    withMenu.rows.map((row) => row.name + (row.under ? ' under .' + row.under : '')).join(', ') + `, ${speedRows} speeds`,
)
/* Nothing of this is left for the pages that come after. */
await resumePage.evaluate((key) => window.localStorage.removeItem(key), SAVED_KEY)
await resumePage.close()

/* ------------------------------- the bar under the offer, on a tight player */

/*
 * Nothing of the control bar shows through the offer that covers it.
 *
 * From 300px down the offer is drawn over the bar rather than above it - left
 * and right 8px, bottom 8px - because a 159x89 player has nowhere to stack the
 * two, and the stylesheet justifies that by saying answering the offer is the
 * only thing left to do. The bar did not know that. It stayed lit and 44px
 * tall underneath, and the offer's background is translucent glass over a
 * backdrop blur, so a viewer could see Settings and full screen through it and
 * aim at them - while every tap in that band landed on the offer, whose
 * right-hand answer is Start over. Aiming at Settings forgot where you were.
 *
 * The interception is not the bug: the offer has to take the taps in its own
 * band or it could never be answered. What must not be there is a target worth
 * aiming at. So this asks what can be seen in that band, and names what a tap
 * there would have reached instead. The seek bar is counted with the buttons -
 * it lands in the same band, and a drag on it under the offer does as little.
 *
 * The bar is measured before the offer arrives too, for two reasons: a fix
 * that takes the bar away leaves nothing to look up afterwards, and a check
 * that found no bar in the first place would pass by measuring nothing.
 *
 * The duration is stubbed here exactly as it is for the menu checks above -
 * the hook ignores a saved position under 15 seconds and the demo clip runs 14
 * - so a pass is no evidence that real 15-second media was ever involved. The
 * coarse pointer is the one thing not faked: it is asserted, because the 44px
 * targets that make the bar worth aiming at exist only under it.
 */
const TIGHT = 300
/*
 * A touch-capable desktop viewport rather than a phone: the player has to be
 * 300px wide inside a page with room to hold it, and what the tiers and the
 * target sizes care about is the pointer, not the screen.
 */
const tightPage = await browser.newPage({ viewport: { width: 1100, height: 900 }, hasTouch: true })
await tightPage.goto(BASE, { waitUntil: 'networkidle' })
await tightPage.locator('#single').scrollIntoViewIfNeeded()
await tightPage.waitForTimeout(1200)
await tightPage.evaluate(
  ([sel, w]) => {
    document.querySelector(sel + ' .xp-root').style.width = w + 'px'
  },
  [SINGLE, TIGHT],
)
/* The bar is up only while something holds it up; the offer does that itself. */
await tightPage.locator(SINGLE + ' .xp-root').hover()
await tightPage.waitForTimeout(400)

/*
 * Everything in the control bar a viewer could aim at, with what each one's
 * centre actually hits. Visible means visible to a viewer rather than merely
 * present: the controls fade by opacity on an ancestor and a tier can take one
 * away with display: none, so the whole chain is walked.
 */
const tightProbe = (sel) => {
  const root = document.querySelector(sel + ' .xp-root')
  const box = root.getBoundingClientRect()
  const visible = (el) => {
    for (let node = el; node && node !== document.body; node = node.parentElement) {
      const s = getComputedStyle(node)
      if (s.display === 'none' || s.visibility !== 'visible' || Number(s.opacity) === 0) return false
    }
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  }
  /*
   * What a hit element is, in words: its own class if it has one, else the
   * nearest thing above it that does - a tap that reaches the offer's own
   * text has reached the offer, and "span" alone would not say so.
   */
  const describe = (el) => {
    if (!el) return 'nothing'
    const named = el.classList.length ? el : el.closest('[class]')
    return named ? named.tagName.toLowerCase() + '.' + named.classList[0] : el.tagName.toLowerCase()
  }
  const offer = root.querySelector('.xp-resume')
  const o = offer && offer.getBoundingClientRect()
  return {
    width: Math.round(box.width),
    coarse: matchMedia('(pointer: coarse)').matches,
    shown: root.classList.contains('xp-show'),
    offer: offer && {
      text: offer.textContent.trim(),
      top: Math.round(o.top - box.top),
      bottom: Math.round(o.bottom - box.top),
    },
    controls: [...root.querySelectorAll('.xp-controls [aria-label], .xp-controls [role="slider"]')].map((el) => {
      const r = el.getBoundingClientRect()
      const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      return {
        name: el.getAttribute('aria-label') ?? el.className.toString().split(' ')[0],
        seen: visible(el),
        top: Math.round(r.top - box.top),
        bottom: Math.round(r.bottom - box.top),
        takes: at === el || el.contains(at) ? null : describe(at),
      }
    }),
  }
}

const tightBefore = await tightPage.evaluate(tightProbe, SINGLE)
const tightBarSeen = tightBefore.controls.filter((c) => c.seen)
check(
  'a coarse pointer and a 300px player give the offer a bar to cover',
  tightBefore.coarse && tightBefore.width === TIGHT && tightBarSeen.length >= 3,
  `${tightBefore.width}px, coarse ${tightBefore.coarse}, bar shows ${tightBarSeen.map((c) => c.name).join(', ') || 'nothing'}`,
)

await tightPage.evaluate(
  ([sel, key, at]) => {
    const video = document.querySelector(sel + ' video.xp-video')
    /* An own property shadows the prototype's getter, as above. */
    Object.defineProperty(video, 'duration', { configurable: true, get: () => 600 })
    window.localStorage.setItem(key, String(at))
    video.dispatchEvent(new Event('loadedmetadata'))
  },
  [SINGLE, SAVED_KEY, 83],
)
await tightPage.waitForTimeout(400)
const tightUp = await tightPage.evaluate(tightProbe, SINGLE)
/* Measured against where the bar was, so a fix that hides it cannot empty this. */
const tightCovered = tightUp.offer
  ? tightBarSeen.filter((c) => c.bottom > tightUp.offer.top && c.top < tightUp.offer.bottom)
  : []
check(
  'and the offer lands on top of that bar rather than above it',
  tightUp.offer !== null && tightUp.offer.text.includes('1:23') && tightCovered.length >= 3,
  tightUp.offer
    ? `offer y ${tightUp.offer.top}-${tightUp.offer.bottom} over ${tightCovered.map((c) => c.name).join(', ') || 'nothing'}`
    : 'no offer, so nothing below is being tested',
)

const tightShowsThrough = tightUp.offer
  ? tightUp.controls.filter(
      (c) => c.bottom > tightUp.offer.top && c.top < tightUp.offer.bottom && (c.seen || c.takes === null),
    )
  : []
check(
  'no part of the bar shows through the offer that covers it',
  tightCovered.length >= 3 && tightShowsThrough.length === 0,
  tightShowsThrough
    .map((c) => `${c.name} ${c.seen ? 'is visible' : 'is hidden'} and a tap there reaches ${c.takes ?? 'it'}`)
    .join('; ') || 'the offer has that band to itself',
)

/*
 * And the bar is a bar again as soon as the offer is answered: a fix that hid
 * it for good would pass the check above and ruin the player.
 */
await tightPage.locator(SINGLE + ' .xp-resume-primary').click()
await tightPage.waitForTimeout(500)
await tightPage.locator(SINGLE + ' .xp-root').hover()
await tightPage.waitForTimeout(400)
const tightAnswered = await tightPage.evaluate(tightProbe, SINGLE)
const tightBack = tightAnswered.controls.filter((c) => c.seen)
/* Clicked for real: elementFromPoint says what is on top, a click says it works. */
const tightMenuFailed = await tightPage
  .locator(SINGLE + ' .xp-settings .xp-btn')
  .click({ timeout: 4000 })
  .then(() => '')
  .catch(
    (err) =>
      String(err.message)
        .split('\n')
        .find((line) => line.includes('intercepts')) ?? 'Settings could not be clicked',
  )
await tightPage.waitForTimeout(300)
const tightMenuRows = await tightPage.locator(SINGLE + ' .xp-menu-item').count()
check(
  'and the bar is back the moment the offer is answered',
  tightAnswered.offer === null && tightBack.length >= tightBarSeen.length && tightMenuFailed === '' && tightMenuRows > 0,
  tightMenuFailed ||
    `${tightBack.map((c) => c.name).join(', ') || 'nothing'} visible, shown ${tightAnswered.shown}, ${tightMenuRows} menu row(s)`,
)
/* Nothing of this is left for the pages that come after. */
await tightPage.evaluate((key) => window.localStorage.removeItem(key), SAVED_KEY)
await tightPage.close()

/* --------------------------- the keyboard when the offer covers the bar */

/*
 * The offer arriving must not throw focus out of the player.
 *
 * Taking the bar away under the offer is what stops a viewer aiming at a
 * control that cannot be pressed - the checks above - but a control that is
 * taken away while it holds focus is blurred by the browser, and focus lands
 * on the document body. The player's key listener is on its own container, so
 * that it never steals an embedding page's shortcuts, which means from the
 * body nothing reaches it at all: Space scrolls the page instead of toggling
 * play, the arrows do not seek, and the way back in is as many Tab presses as
 * the page has links. Focus recovery does not catch it either - it moves focus
 * only when the element that had it has left the document, and a control that
 * is merely not shown is still in it.
 *
 * So both halves are asserted, and neither is about how the bar is hidden:
 * where focus ends up, and whether a key still drives the player once it is
 * there. The second is what makes the first worth having - focus parked on
 * something inert inside the player would pass the first alone.
 *
 * Space is the cheapest key to ask with. The container listener calls
 * preventDefault on every key it handles, so a press that arrives is one
 * toggle and not two, and a press that does not arrive scrolls the page -
 * which is measured as well, because it is the proof that the press went to
 * the document rather than to the player.
 *
 * Keys are known to be alive while an offer is up: with focus on the root,
 * which nothing hides, Space starts playback. So a dead keyboard here is
 * about focus and nothing else. The duration is stubbed as it is above, and a
 * pass is still no evidence about real 15-second media.
 */
const focusWhere = (sel) => {
  const root = document.querySelector(sel + ' .xp-root')
  const active = document.activeElement
  const video = root.querySelector('video.xp-video')
  const offer = root.querySelector('.xp-resume')
  return {
    active: active ? active.tagName.toLowerCase() + [...active.classList].map((c) => '.' + c).join('') : 'nothing',
    inside: !!active && root.contains(active),
    offer: offer && offer.textContent.trim(),
    paused: video.paused,
    /* The harness page, not the player: a Space that misses scrolls it. */
    scrollY: Math.round(window.scrollY),
  }
}

const offerFocusPage = await browser.newPage({ viewport: { width: 1100, height: 900 }, hasTouch: true })
await offerFocusPage.goto(BASE, { waitUntil: 'networkidle' })
await offerFocusPage.locator('#single').scrollIntoViewIfNeeded()
await offerFocusPage.waitForTimeout(1200)
await offerFocusPage.evaluate(
  ([sel, w]) => {
    const root = document.querySelector(sel + ' .xp-root')
    root.style.width = w + 'px'
    /* Muted, so nothing can refuse a play started from a key press. */
    root.querySelector('video.xp-video').muted = true
  },
  [SINGLE, TIGHT],
)
/* A control has to be on screen before it can be focused. */
await offerFocusPage.locator(SINGLE + ' .xp-root').hover()
await offerFocusPage.waitForTimeout(300)
await offerFocusPage.locator(SINGLE + ' .xp-bar .xp-btn-play').focus()
await offerFocusPage.waitForTimeout(200)
const offerFocusBefore = await offerFocusPage.evaluate(focusWhere, SINGLE)
await offerFocusPage.evaluate(
  ([sel, key, at]) => {
    const video = document.querySelector(sel + ' video.xp-video')
    Object.defineProperty(video, 'duration', { configurable: true, get: () => 600 })
    window.localStorage.setItem(key, String(at))
    video.dispatchEvent(new Event('loadedmetadata'))
  },
  [SINGLE, SAVED_KEY, 83],
)
await offerFocusPage.waitForTimeout(500)
const offerFocusUp = await offerFocusPage.evaluate(focusWhere, SINGLE)
check(
  'the play button held focus on a tight player, and then the offer arrived',
  offerFocusBefore.inside &&
    offerFocusBefore.active.includes('xp-btn-play') &&
    offerFocusBefore.offer === null &&
    offerFocusUp.offer !== null &&
    offerFocusUp.offer.includes('1:23') &&
    offerFocusUp.paused,
  `focus on ${offerFocusBefore.active} with ${offerFocusBefore.offer ?? 'no offer'}, then ${offerFocusUp.offer ?? 'still no offer'}, paused ${offerFocusUp.paused}`,
)
check(
  'the offer appearing leaves focus inside the player',
  offerFocusUp.inside,
  `focus was ${offerFocusBefore.active}, after the offer ${offerFocusUp.active}`,
)
await offerFocusPage.keyboard.press(' ')
await offerFocusPage.waitForTimeout(700)
const offerFocusKeyed = await offerFocusPage.evaluate(focusWhere, SINGLE)
check(
  'and a shortcut still reaches the player with the offer up',
  offerFocusKeyed.paused === false && offerFocusKeyed.scrollY === offerFocusUp.scrollY,
  `Space with the offer up: paused ${offerFocusUp.paused} -> ${offerFocusKeyed.paused}, the page scrolled ${offerFocusKeyed.scrollY - offerFocusUp.scrollY}px, focus on ${offerFocusKeyed.active}`,
)
/* Nothing of this is left for the pages that come after. */
await offerFocusPage.evaluate((key) => window.localStorage.removeItem(key), SAVED_KEY)
await offerFocusPage.close()

/* ------------------------------------------------- one home per control */

/*
 * Every control the bar sheds has to arrive somewhere, and a tier system is
 * only ever checked at the boundaries it was designed against. This walks the
 * widths in between, where a mirrored condition - shown here only when hidden
 * there - can be wrong without anyone having chosen it.
 *
 * Two things it learned the hard way. Count by visibility, not by presence:
 * the menu rows sit in the DOM at every width and collapse to nothing, so a
 * querySelector count reports every folded control twice. And check that the
 * menu is usable, not just that the row is in it - a control folded into a
 * panel that does not fit has been hidden rather than moved, which is the
 * failure this whole arrangement exists to avoid.
 */
const LADDER = LADDER_CASE
await page.locator('#ladder').scrollIntoViewIfNeeded()
await page.evaluate((sel) => {
  const v = document.querySelector(sel + ' video.xp-video')
  v.muted = true
  v.pause()
}, LADDER)

/*
 * Picture in picture renders only where the browser offers it. The browser
 * this suite runs in does, and the check says so: if one without it ever runs
 * the suite, the failure names that reason instead of passing by never looking
 * or reporting a missing control as a layout bug.
 */
const pipOffered = await page.evaluate(() => document.pictureInPictureEnabled === true)
check('picture in picture is offered here, so its home is checked too', pipOffered, String(pipOffered))

const ON_BAR = {
  play: /^(Play|Pause|Replay)$/,
  sound: /^(Mute|Unmute)$/,
  quality: /^Quality/,
  fullscreen: /^(Full screen|Exit full screen)$/,
  ...(pipOffered && { pip: /^Picture in picture$/ }),
}
const IN_MENU = { sound: /Sound/, quality: /Quality/, pip: /Picture in picture/ }

const homeless = []
const doubled = []
const brokenMenu = []

for (let width = 600; width >= 150; width -= 10) {
  await page.evaluate(
    ([sel, w]) => {
      document.querySelector(sel + ' .xp-root').parentElement.style.width = w + 'px'
    },
    [LADDER, width],
  )
  await page.waitForTimeout(120)

  const onBar = await page.evaluate(
    (sel) =>
      [...document.querySelectorAll(sel + ' .xp-bar [aria-label]')]
        .filter((el) => getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0)
        .map((el) => el.getAttribute('aria-label')),
    LADDER,
  )

  const settings = page.locator(LADDER + ' [aria-label="Settings"]').first()
  const opened = await settings
    .click({ timeout: 2500 })
    .then(() => true)
    .catch(() => false)
  let menu = { rows: [], fits: true, lastReachable: true }
  if (opened) {
    await page.waitForTimeout(160)
    menu = await page.evaluate((sel) => {
      const root = document.querySelector(sel + ' .xp-root')
      const box = root.getBoundingClientRect()
      const panel = root.querySelector('.xp-menu')
      if (!panel) return { rows: [], fits: false, lastReachable: false }
      const pb = panel.getBoundingClientRect()
      const rows = [...panel.querySelectorAll('[role="menuitem"]')].filter(
        (el) => el.getBoundingClientRect().height > 0,
      )
      /*
       * Scroll to the bottom before asking whether the last row can be hit.
       * A row reached by scrolling is reached; what this looks for is a row
       * that no scrolling brings back, because the panel hangs outside a
       * root that is overflow: hidden. Asking without scrolling first fails
       * every player short enough to need it, which is a statement about the
       * check rather than the player.
       */
      const scroller =
        panel.scrollHeight > panel.clientHeight ? panel : panel.querySelector('.xp-menu-panel')
      if (scroller && scroller.scrollHeight > scroller.clientHeight) {
        scroller.scrollTop = scroller.scrollHeight
      }
      const last = rows[rows.length - 1]
      const lb = last && last.getBoundingClientRect()
      const hit = lb && document.elementFromPoint(lb.left + lb.width / 2, lb.top + lb.height / 2)
      return {
        rows: rows.map((el) => el.textContent.trim()),
        fits:
          pb.left >= box.left - 1 &&
          pb.right <= box.right + 1 &&
          pb.top >= box.top - 1 &&
          pb.bottom <= box.bottom + 1,
        lastReachable: !!(last && hit && (hit === last || last.contains(hit))),
      }
    }, LADDER)
    await page.keyboard.press('Escape').catch(() => {})
    await page.waitForTimeout(110)
  }

  for (const [name, onBarPattern] of Object.entries(ON_BAR)) {
    const bar = onBar.some((label) => onBarPattern.test(label)) ? 1 : 0
    const inMenu = IN_MENU[name] && menu.rows.some((row) => IN_MENU[name].test(row)) ? 1 : 0
    if (bar + inMenu === 0) homeless.push(width + "px " + name)
    if (bar + inMenu > 1) doubled.push(width + "px " + name)
  }
  if (!opened) brokenMenu.push(width + "px could not be opened")
  else if (!menu.fits) brokenMenu.push(width + "px spills outside the player")
  else if (!menu.lastReachable) brokenMenu.push(width + "px last row unreachable")
}

check(
  'every control has a home at every width from 600 to 150',
  homeless.length === 0,
  homeless.slice(0, 6).join(', '),
)
check(
  'no control is in two places at once',
  doubled.length === 0,
  doubled.slice(0, 6).join(', '),
)
check(
  'the menu the bar folds into is usable at every width',
  brokenMenu.length === 0,
  brokenMenu.length + ' widths: ' + brokenMenu.slice(0, 4).join(', '),
)

/* ---------------------------------------------------- the bar's own height */

/*
 * The tiers shrink the bar as well as emptying it: 52px, then 46px from 560px
 * down, then 44px from 220px down. The blocking layer, the resume card and the
 * menu's height cap all measure themselves from that value.
 *
 * A container query cannot style its own container, only what is inside it.
 * When the tiers moved from viewport media queries to container queries the
 * value stayed on the root, so every narrow player kept the 52px bar - a check
 * of which buttons were visible could never have noticed, because the buttons
 * were all correct and only the strip around them was wrong.
 */
const wrongBar = []
for (const [width, want] of [[600, 52], [561, 52], [560, 46], [301, 46], [221, 46], [220, 44], [160, 44]]) {
  await page.evaluate(
    ([sel, w]) => {
      document.querySelector(sel + ' .xp-root').parentElement.style.width = w + 'px'
    },
    [LADDER, width],
  )
  await page.waitForTimeout(120)
  const got = await page.evaluate(
    (sel) => document.querySelector(sel + ' .xp-bar').getBoundingClientRect().height,
    LADDER,
  )
  if (Math.abs(got - want) > 0.5) wrongBar.push(`${width}px ${got}px, want ${want}px`)
}
check('the bar gets shorter with the tiers', wrongBar.length === 0, wrongBar.join('; ') || '52, 46 and 44 where they belong')

/* ------------------------------------------- selecting a stretch of it */

/*
 * The handles belong to the host: nothing is drawn until one is given. Both of
 * the checks below are about the seek bar underneath them - a handle that lets
 * the press through seeks the video, and an arrow key that reaches the window
 * seeks it by five seconds, which is the whole reason this is driven rather
 * than reasoned about.
 */
const RANGE_CASE = '[data-case="range"]'
await page.locator('#range').scrollIntoViewIfNeeded()
await page.waitForTimeout(800)
check('no handles on the bar until a range is given', (await page.locator(`${RANGE_CASE} .xp-range-handle`).count()) === 0)

await page.locator('#range [data-range-toggle]').click()
const handles = page.locator(`${RANGE_CASE} .xp-range-handle`)
check('a range puts a handle at each end', (await handles.count()) === 2)

const reported = () => page.locator('#range [data-range]').textContent()
const rangePlayhead = () => page.evaluate((sel) => document.querySelector(`${sel} video.xp-video`).currentTime, RANGE_CASE)
const handleValues = () =>
  page.evaluate(
    (sel) => [...document.querySelectorAll(`${sel} .xp-range-handle`)].map((h) => ({
      now: Number(h.getAttribute('aria-valuenow')),
      text: h.getAttribute('aria-valuetext'),
      label: h.getAttribute('aria-label'),
    })),
    RANGE_CASE,
  )

const seekBox = await page.locator(`${RANGE_CASE} .xp-seek`).boundingBox()
const startBox = await handles.first().boundingBox()
await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2)
await page.mouse.down()
await page.mouse.move(seekBox.x + 2, startBox.y + startBox.height / 2, { steps: 10 })
await page.mouse.up()
const dragged = await reported()
check('dragging a handle moves the selection it was given', /^0\.\d\d to 10\.00$/.test(dragged), dragged)
check('and the press never reaches the seek bar under it', (await rangePlayhead()) === 0, `${await rangePlayhead()}s`)

await handles.last().focus()
const endBefore = (await handleValues())[1]
await page.keyboard.press('ArrowLeft')
const endAfter = (await handleValues())[1]
check('an arrow key moves the handle by a second, not the playhead by five', endBefore.now - endAfter.now === 1 && (await rangePlayhead()) === 0, `${endBefore.now} -> ${endAfter.now}`)
check('and the handle says where it is in words', endAfter.text === `${endAfter.now} seconds` && /selection/i.test(endAfter.label), `${endAfter.label}: ${endAfter.text}`)

for (let press = 0; press < 20; press++) await page.keyboard.press('ArrowLeft')
const [low, high] = await handleValues()
const stillApart = await page.evaluate(
  (sel) => {
    const said = document.querySelector(sel).textContent.match(/([\d.]+) to ([\d.]+)/)
    return said ? +(Number(said[2]) - Number(said[1])).toFixed(2) : null
  },
  '#range [data-range]',
)
check('the handles cannot be pushed through each other', stillApart === 0.2 && high.now >= low.now, `${stillApart}s apart`)

check('no uncaught page errors', pageErrors.length === 0, pageErrors.join(' | '))
await page.close()

/* -------------------------------------------------------------- mobile */

const phone = await browser.newPage({ ...devices['iPhone 13'] })
await phone.goto(BASE, { waitUntil: 'networkidle' })
await phone.waitForTimeout(1500)
check(
  'no horizontal overflow on a phone',
  !(await phone.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)),
)
check('controls are reachable on a phone', (await phone.locator('.xp-controls').count()) > 0)

/*
 * `.xp-controls` is the full-width gradient at the bottom, and 40px of its top
 * is transparent padding that looks exactly like video. While the bar is up it
 * took pointer events across that whole box - a fifth of a phone-sized player -
 * so a double tap to seek in the lower half hit the gradient and never reached
 * the surface. The band over the bar itself is a different matter: taps there
 * are meant to be caught, because that is where the controls actually are.
 */
await phone.locator('#ladder').scrollIntoViewIfNeeded()
await phone.waitForTimeout(600)
const surfaceRoot = phone.locator('[data-case="ladder"] .xp-root')
const sb = await surfaceRoot.boundingBox()
await phone.touchscreen.tap(sb.x + sb.width / 2, sb.y + sb.height / 2)
await phone.waitForTimeout(400)
const atDepth = await phone.evaluate(() => {
  const root = document.querySelector('[data-case="ladder"] .xp-root')
  const r = root.getBoundingClientRect()
  const at = (frac) => {
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height * frac)
    return el ? el.className.toString().split(' ')[0] : null
  }
  return { shown: root.classList.contains('xp-show'), at45: at(0.45), at55: at(0.55), at80: at(0.8) }
})
check(
  'a tap over the picture reaches the surface while the bar is up',
  atDepth.shown && atDepth.at45 !== 'xp-controls' && atDepth.at55 !== 'xp-controls',
  JSON.stringify(atDepth),
)

/*
 * The tiers exist so that touch targets never shrink, and nothing tested that.
 *
 * The stylesheet grows every button to 44px under `pointer: coarse`, and the
 * commit that introduced the tiers claimed 44px targets from 600px down to
 * 159px. But the only other 44px assertion in this file is about the buttons
 * inside blocking panels, and it runs on the desktop page - so the claim the
 * tiers were built to keep was resting on the stylesheet alone. A media query
 * that stopped matching, or a `flex` that shrank a button below its declared
 * size the way one did before, would have gone unnoticed.
 *
 * Its own page, for the reason the menu checks below have one: this resizes
 * the player, and a mutated width left behind changes what every later check
 * on a shared page is measuring.
 *
 * The button count is asserted too. Every filter here narrows - visible
 * buttons, then undersized ones - so a selector that matched nothing would
 * report an empty list of failures, which reads exactly like success.
 */
const targetPhone = await browser.newPage({ ...devices['iPhone 13'] })
await targetPhone.goto(BASE, { waitUntil: 'networkidle' })
await targetPhone.locator('#ladder').scrollIntoViewIfNeeded()
await targetPhone.waitForTimeout(1200)
check(
  'the phone context reports a coarse pointer',
  await targetPhone.evaluate(() => matchMedia('(pointer: coarse)').matches),
  'without it the sizes below are the desktop ones and prove nothing',
)
const undersized = []
const counted = []
for (const width of [600, 520, 420, 380, 300, 260, 220, 190, 159]) {
  const seen = await targetPhone.evaluate(
    ([sel, w]) => {
      const root = document.querySelector(sel + ' .xp-root')
      root.style.width = w + 'px'
      root.getBoundingClientRect()
      const shown = [...root.querySelectorAll('.xp-btn')].filter((b) => b.offsetParent !== null)
      return {
        total: shown.length,
        small: shown
          .map((b) => {
            const r = b.getBoundingClientRect()
            return {
              label: b.getAttribute('aria-label') ?? '?',
              w: Math.round(r.width),
              h: Math.round(r.height),
            }
          })
          .filter((b) => b.w < 44 || b.h < 44),
      }
    },
    [LADDER_CASE, width],
  )
  counted.push(`${width}px:${seen.total}`)
  for (const b of seen.small) undersized.push(`${width}px ${b.label} ${b.w}x${b.h}`)
}
check(
  'every tier still shows controls to measure',
  counted.every((c) => Number(c.split(':')[1]) >= 3),
  counted.join(' '),
)
check(
  'every control keeps a 44px touch target at every tier',
  undersized.length === 0,
  undersized.slice(0, 6).join(', '),
)
await targetPhone.close()

/*
 * The menu is anchored above a bar at the bottom of a player that is
 * overflow: hidden, and its height was capped at a constant taller than a
 * phone-sized player. The speed panel ran off the top edge with its first
 * rows unreachable - worst exactly where the bar is hardest to use, and
 * fatal to any plan that folds controls into this menu to save width.
 *
 * Checked on the deepest panel rather than the main one: the main panel is
 * three rows and fits, so a check that only opened the menu would pass while
 * the panel a viewer actually needs stayed cut off.
 */
/*
 * Its own page. Sharing one with the checks above left this opening a menu on
 * a player that had already been played and whose controls had since hidden
 * themselves, so the failure was a stale bar rather than anything about the
 * menu - and it took a probe on a fresh page to tell those apart.
 */
const menuPhone = await browser.newPage({ ...devices['iPhone 13'] })
await menuPhone.goto(BASE, { waitUntil: 'networkidle' })
await menuPhone.waitForTimeout(1500)
await menuPhone.locator('#ladder').scrollIntoViewIfNeeded()
await menuPhone.waitForTimeout(700)
const phoneRoot = menuPhone.locator('[data-case="ladder"] .xp-root')
const pb = await phoneRoot.boundingBox()
await menuPhone.touchscreen.tap(pb.x + pb.width / 2, pb.y + pb.height / 2)
await menuPhone.waitForTimeout(500)
await menuPhone.locator('[data-case="ladder"] .xp-settings .xp-btn').tap()
await menuPhone.waitForTimeout(400)
/*
 * A menu row is a target like any button on the bar, and it was 19px tall on a
 * phone: its padding was written as a bare `.xp-menu-item` rule, which loses to
 * the defence layer's `.xp-root button { padding: 0 !important }`. Measured on
 * both the main panel and a sub-panel, so the back row is counted too.
 */
const menuRowHeights = () =>
  menuPhone.evaluate(() =>
    [...document.querySelectorAll('[data-case="ladder"] .xp-menu [role^="menuitem"]')]
      .filter((el) => el.getBoundingClientRect().width > 0)
      .map((el) => `${el.textContent.trim()}:${Math.round(el.getBoundingClientRect().height)}`),
  )
const phoneRows = await menuRowHeights()
/*
 * Clicked directly rather than through a locator. What this check measures is
 * whether the panel fits once it is open; Playwright's actionability wait was
 * failing on a 19px row for reasons that had nothing to do with that, and
 * fighting it here would only have made the check flaky about the wrong thing.
 */
const opened = await menuPhone.evaluate(() => {
  const row = [...document.querySelectorAll('[data-case="ladder"] .xp-menu-item')].find((el) =>
    el.textContent.trim().startsWith('Playback speed'),
  )
  if (!row) return false
  row.click()
  return true
})
await menuPhone.waitForTimeout(400)
const panel = await menuPhone.evaluate(() => {
  const root = document.querySelector('[data-case="ladder"] .xp-root')
  const menu = root.querySelector('.xp-menu')
  if (!menu) return null
  const r = root.getBoundingClientRect()
  const m = menu.getBoundingClientRect()
  return {
    over: Math.round(Math.max(0, r.top - m.top) + Math.max(0, m.bottom - r.bottom)),
    scrollable: menu.scrollHeight > menu.clientHeight + 1,
    rows: menu.querySelectorAll('button').length,
  }
})
/*
 * The menu box has to fit; its rows do not. A panel taller than the space it
 * has is allowed to scroll inside itself, and a row you reach by scrolling is
 * reached. A row outside the box is behind overflow: hidden and gone.
 */
check(
  'the settings menu fits inside the player on a phone',
  opened && panel !== null && panel.over === 0,
  opened
    ? panel && `${panel.over}px outside, ${panel.rows} rows, scrollable ${panel.scrollable}`
    : 'the speed panel never opened - this check tested nothing',
)
phoneRows.push(...(await menuRowHeights()))
check(
  'every menu row is a 44px target on a phone',
  phoneRows.length > 3 && phoneRows.every((row) => Number(row.split(':').pop()) >= 44),
  phoneRows.join(', '),
)
await menuPhone.close()

/*
 * `.xp-center` holds the big play button and the error panel's Try again, and
 * it sat at z-index 4 under the bar's 5. On a tall player those buttons land
 * above the bar's box and nothing notices; on a short one they land inside it
 * and the bar takes the tap. An error also sets `locked`, which pins the
 * controls visible - so the bar is guaranteed to be up at exactly the moment
 * the button underneath it is the way out.
 */
/*
 * Quality, sound and picture in picture live on the bar on a wide player and
 * as settings rows on a narrow one, and the two visibilities are meant to be
 * exact mirrors: data-xp-until on the bar, data-xp-from in the menu, naming the
 * same tier.
 *
 * "Shown only when the other is hidden" is the kind of condition that is right
 * at the widths you happened to try and wrong at a boundary you did not, so
 * these are the boundaries themselves - one pixel either side of 560, 300 and
 * 220 - rather than round numbers in the middle of each tier. A player wider
 * than the phone's screen is measured on a desktop page instead, so the menu
 * button is somewhere a click can reach.
 */
const mirrorFails = []
for (const w of [561, 560, 301, 300, 221, 220]) {
  const m = await browser.newPage(w > 390 ? { viewport: { width: 1200, height: 900 } } : { ...devices['iPhone 13'] })
  await m.goto(BASE, { waitUntil: 'networkidle' })
  await m.waitForTimeout(1200)
  await m.locator('#ladder').scrollIntoViewIfNeeded()
  await m.evaluate((px) => {
    const h = document.querySelector('[data-case="ladder"]')
    h.style.width = `${px}px`
    h.style.maxWidth = `${px}px`
  }, w)
  await m.waitForTimeout(400)
  /*
   * isVisible, not count. Below 220px the big play button is display: none but
   * still in the DOM, so count() returns one and click() then waits for an
   * element that will never be actionable.
   */
  const big = m.locator('[data-case="ladder"] .xp-bigplay')
  if (await big.isVisible()) {
    await big.click()
    await m.waitForTimeout(800)
  }
  await m.locator('[data-case="ladder"] .xp-root').hover()
  await m.locator('[data-case="ladder"] .xp-settings .xp-btn').click()
  await m.waitForTimeout(350)
  const { menuOpen, pipHere, ...where } = await m.evaluate(() => {
    const root = document.querySelector('[data-case="ladder"] .xp-root')
    const vis = (el) => !!el && el.getBoundingClientRect().width > 0
    const row = (name) =>
      [...root.querySelectorAll('.xp-menu-item')].find((x) => x.textContent.trim().startsWith(name))
    return {
      menuOpen: vis(row('Playback speed')),
      pipHere: document.pictureInPictureEnabled === true,
      quality: [vis(root.querySelector('.xp-quality .xp-btn')), vis(row('Quality'))],
      sound: [vis(root.querySelector('.xp-volume .xp-btn')), vis(row('Sound'))],
      pip: [vis(root.querySelector('.xp-bar [aria-label="Picture in picture"]')), vis(row('Picture in picture'))],
    }
  })
  /*
   * A menu that never opened has no rows, which is also the right answer on the
   * wide side of every boundary - so without this, a click that missed would
   * pass every one of those widths. Picture in picture is left out where the
   * browser does not offer it, rather than reported as a control with no home.
   */
  if (!menuOpen) mirrorFails.push(`the settings menu did not open at ${w}px`)
  if (!pipHere) delete where.pip
  for (const [name, [onBar, inMenu]] of Object.entries(where)) {
    if (onBar === inMenu) mirrorFails.push(`${name} at ${w}px: bar=${onBar} menu=${inMenu}`)
  }
  await m.close()
}
check(
  'quality, sound and picture in picture are in exactly one place at every tier boundary',
  mirrorFails.length === 0,
  mirrorFails.join('; ') || 'all three mirrored either side of 560px, 300px and 220px',
)

/*
 * Picture in picture is one window for the whole page, and "On" in a player's
 * menu is a promise about that player. The toggle used to ask the page whether
 * anything was in picture in picture, so with another player already there,
 * choosing On closed that window and opened nothing.
 */
const pipPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
let pipOwners = []
try {
  await pipPage.goto(BASE, { waitUntil: 'domcontentloaded' })
  await pipPage.waitForFunction(
    () => ['ladder', 'single'].every((c) => document.querySelector(`[data-case="${c}"] video.xp-video`)?.readyState >= 1),
    null,
    { timeout: 30000 },
  )
  const owner = () =>
    pipPage.evaluate(() => document.pictureInPictureElement?.closest('[data-case]')?.getAttribute('data-case') ?? null)
  await pipPage.evaluate(() => {
    document.querySelector('[data-case="ladder"]').style.width = '600px'
    document.querySelector('[data-case="single"]').style.width = '400px'
  })
  const second = pipPage.locator('[data-case="single"] .xp-root')

  const first = pipPage.locator('[data-case="ladder"] .xp-root')
  await first.scrollIntoViewIfNeeded()
  await first.hover()
  await pipPage.locator('[data-case="ladder"] .xp-bar [aria-label="Picture in picture"]').click()
  await pipPage.waitForFunction(() => !!document.pictureInPictureElement, null, { timeout: 5000 }).catch(() => {})
  pipOwners.push(await owner())

  await second.scrollIntoViewIfNeeded()
  await second.hover()
  await pipPage.locator('[data-case="single"] .xp-settings .xp-btn').click()
  await pipPage.locator('[data-case="single"] .xp-menu-item', { hasText: 'Picture in picture' }).click({ timeout: 5000 })
  await pipPage.locator('[data-case="single"] [role="menuitemradio"]', { hasText: /^On$/ }).click({ timeout: 5000 })
  await pipPage
    .waitForFunction(() => !!document.pictureInPictureElement?.closest('[data-case="single"]'), null, { timeout: 3000 })
    .catch(() => {})
  pipOwners.push(await owner())
} catch (err) {
  pipOwners.push('error: ' + String(err.message).split('\n')[0])
}
check(
  "choosing On in one player's menu takes picture in picture from another",
  pipOwners[0] === 'ladder' && pipOwners[1] === 'single',
  'owner after each step: ' + pipOwners.join(' -> '),
)
await pipPage.close()

const fresh = await browser.newPage({ ...devices['iPhone 13'] })
await fresh.goto(BASE, { waitUntil: 'networkidle' })
await fresh.waitForTimeout(1500)
await fresh.locator('#ladder').scrollIntoViewIfNeeded()
await fresh.waitForTimeout(600)
const centred = await fresh.evaluate(() => {
  const host = document.querySelector('[data-case="ladder"]')
  host.style.width = '250px'
  host.style.maxWidth = '250px'
  const root = host.querySelector('.xp-root')
  root.classList.add('xp-show') // an error pins the bar visible; this is that state
  const play = root.querySelector('.xp-bigplay')
  if (!play) return null
  const b = play.getBoundingClientRect()
  const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)
  return { reaches: play.contains(hit) || hit === play, blocker: hit ? hit.className.toString().split(' ')[0] : 'nothing' }
})
check(
  'the centred overlay is reachable on a narrow player',
  centred !== null && centred.reaches,
  centred ? `hit ${centred.blocker}` : 'no big play button rendered - check is not testing anything',
)
await fresh.close()
/* A handle is a control, and controls grow for a finger like every other one. */
await phone.locator('#range').scrollIntoViewIfNeeded()
await phone.locator('#range [data-range-toggle]').click()
await phone.waitForTimeout(400)
const fingerSized = await phone.evaluate(() =>
  [...document.querySelectorAll('[data-case="range"] .xp-range-handle')].map((handle) => {
    const r = handle.getBoundingClientRect()
    return { w: Math.round(r.width), h: Math.round(r.height) }
  }),
)
check(
  'the selection handles are big enough to hit on a phone',
  fingerSized.length === 2 && fingerSized.every((box) => box.w >= 44 && box.h >= 44),
  JSON.stringify(fingerSized),
)

await phone.close()

/* ------------------------------------ what the stylesheet says is drawn */

/*
 * The defence layer is `.xp-root button`, specificity 0-1-1, and it resets
 * background, border, padding, colour and shadow with !important. A rule
 * written with a bare class is 0-1-0 and loses however many !importants it
 * carries, so the big play button, Try again and Resume were drawn with no
 * background at all, and the subtitles button looked the same on and off.
 * Every check above asks where a control is; none asked what it looks like,
 * which is how the stylesheet and the screen disagreed for this long.
 */
const TRANSPARENT = 'rgba(0, 0, 0, 0)'
const look = await browser.newPage({ viewport: { width: 1200, height: 900 } })
await look.goto(BASE, { waitUntil: 'networkidle' })
await look.locator('#ladder').scrollIntoViewIfNeeded()
await look.waitForTimeout(1200)
const backgrounds = await look.evaluate(
  ([sel, errorHtml, resumeHtml]) => {
    const root = document.querySelector(sel + ' .xp-root')
    const error = document.createElement('div')
    error.className = 'xp-center xp-center-blocking xp-center-error xp-probe'
    error.innerHTML = errorHtml
    const resume = document.createElement('div')
    resume.className = 'xp-resume xp-probe'
    resume.innerHTML = resumeHtml
    root.append(error, resume)
    const bg = (s) => {
      const el = root.querySelector(s)
      return el ? getComputedStyle(el).backgroundColor : 'missing'
    }
    const seen = { bigplay: bg('.xp-bigplay'), retry: bg('.xp-error-retry'), resume: bg('.xp-resume-primary') }
    root.querySelectorAll('.xp-probe').forEach((n) => n.remove())
    return seen
  },
  [LADDER_CASE, ERROR_MARKUP, RESUME_MARKUP],
)
check(
  'big play, Try again and Resume are drawn with their backgrounds',
  Object.values(backgrounds).every((c) => c !== TRANSPARENT && c !== 'missing'),
  JSON.stringify(backgrounds),
)

const subtitlesButton = () =>
  look.evaluate((sel) => {
    const b = document.querySelector(sel + ' .xp-bar button[aria-pressed]')
    return b && { on: b.getAttribute('aria-pressed'), color: getComputedStyle(b).color }
  }, LADDER_CASE)
const subsOff = await subtitlesButton()
await look.locator(LADDER_CASE + ' .xp-root').focus()
await look.keyboard.press('c')
await look.waitForTimeout(300)
const subsOn = await subtitlesButton()
check(
  'the subtitles button looks different on and off',
  subsOff?.on === 'false' && subsOn?.on === 'true' && subsOff.color !== subsOn.color,
  `${JSON.stringify(subsOff)} -> ${JSON.stringify(subsOn)}`,
)

await look.locator(LADDER_CASE + ' .xp-root').hover()
await look.locator(LADDER_CASE + ' .xp-settings .xp-btn').click()
await look.waitForTimeout(300)
const deskRows = await look.evaluate((sel) =>
  [...document.querySelectorAll(sel + ' .xp-menu .xp-menu-item')]
    .filter((el) => el.getBoundingClientRect().width > 0)
    .map((el) => getComputedStyle(el).paddingLeft),
  LADDER_CASE,
)
check(
  'a menu row keeps its padding',
  deskRows.length > 0 && deskRows.every((p) => Number.parseFloat(p) > 0),
  deskRows.join(', '),
)
await look.close()

/* ----------------------------------------------- which press does what */

/*
 * Only the primary button is a click on the picture. A right click to open the
 * browser's own menu - to copy the video address, say - paused the video on the
 * way. Fullscreen is counted rather than entered, so the page stays as it is.
 */
const COUNT_FULLSCREEN = () => {
  window.__xpFullscreenAsks = 0
  Element.prototype.requestFullscreen = function () {
    window.__xpFullscreenAsks += 1
    return Promise.resolve()
  }
}
const presses = await browser.newPage({ viewport: { width: 1200, height: 900 } })
await presses.addInitScript(COUNT_FULLSCREEN)
await presses.goto(BASE, { waitUntil: 'networkidle' })
await presses.locator('#ladder').scrollIntoViewIfNeeded()
await presses.waitForTimeout(1200)
const isPaused = (p) => p.evaluate((sel) => document.querySelector(sel).paused, V)
await presses.evaluate((sel) => {
  document.querySelector(sel).muted = true
}, V)
await presses.locator(LADDER_CASE + ' .xp-bigplay').click()
await presses.waitForTimeout(800)
const pictureBox = await presses.locator(LADDER_CASE + ' .xp-root').boundingBox()
const pictureX = pictureBox.x + pictureBox.width / 2
const pictureY = pictureBox.y + pictureBox.height / 3
const playingBefore = !(await isPaused(presses))
/*
 * Right only. A middle click also starts the browser's autoscroll on Windows,
 * which then swallows the next click - so the left click below would be
 * measuring the browser rather than the player.
 */
await presses.mouse.click(pictureX, pictureY, { button: 'right' })
await presses.waitForTimeout(500)
const playingAfterRight = !(await isPaused(presses))
await presses.mouse.click(pictureX, pictureY)
await presses.waitForTimeout(500)
const pausedByLeft = await isPaused(presses)
check(
  'a right click on the picture leaves playback alone',
  playingBefore && playingAfterRight,
  `playing before ${playingBefore}, after ${playingAfterRight}`,
)
check('and a left click still toggles it', pausedByLeft)
await presses.mouse.dblclick(pictureX, pictureY)
await presses.waitForTimeout(300)
check(
  'a mouse double click still asks for full screen',
  (await presses.evaluate(() => window.__xpFullscreenAsks)) >= 1,
  `${await presses.evaluate(() => window.__xpFullscreenAsks)} asks`,
)
await presses.close()

/*
 * A double tap on the sides of the picture skips ten seconds. The browser also
 * reports it as a dblclick, which is the mouse gesture for full screen, so the
 * skip took the player full screen as well. The skip is asserted too: without
 * it, a double tap that never registered would pass by asking for nothing.
 */
const taps = await browser.newPage({ ...devices['iPhone 13'] })
await taps.addInitScript(COUNT_FULLSCREEN)
await taps.goto(BASE, { waitUntil: 'networkidle' })
await taps.locator('#ladder').scrollIntoViewIfNeeded()
await taps.waitForTimeout(1200)
await taps.evaluate((sel) => {
  document.querySelector(sel).muted = true
}, V)
await taps.locator(LADDER_CASE + ' .xp-bigplay').tap()
await taps.waitForTimeout(800)
await taps.evaluate((sel) => document.querySelector(sel).pause(), V)
const tb = await taps.locator(LADDER_CASE + ' .xp-root').boundingBox()
const tapBefore = await taps.evaluate((sel) => document.querySelector(sel).currentTime, V)
await taps.touchscreen.tap(tb.x + tb.width * 0.85, tb.y + tb.height * 0.35)
await taps.waitForTimeout(120)
await taps.touchscreen.tap(tb.x + tb.width * 0.85, tb.y + tb.height * 0.35)
await taps.waitForTimeout(600)
const tapAfter = await taps.evaluate(
  (sel) => ({ t: document.querySelector(sel).currentTime, asks: window.__xpFullscreenAsks }),
  V,
)
check(
  'a double tap skips forward ten seconds',
  tapAfter.t - tapBefore > 8,
  `${tapBefore.toFixed(2)} -> ${tapAfter.t.toFixed(2)}`,
)
check('and does not also go full screen', tapAfter.asks === 0, `${tapAfter.asks} full screen asks`)
await taps.close()

/* ------------------------------------------------ toasts, held still */

/*
 * Reduced motion shortened every animation to 0.01ms, and the toast's
 * animation ends on its fade-out frame with `forwards`, so for anyone who asked
 * for less motion every toast was invisible from the first frame - "+10s",
 * "Muted", "1.5x", all of it.
 */
const calm = await browser.newPage({ viewport: { width: 1200, height: 900 }, reducedMotion: 'reduce' })
await calm.goto(BASE, { waitUntil: 'networkidle' })
await calm.locator('#ladder').scrollIntoViewIfNeeded()
await calm.waitForTimeout(1200)
await calm.locator(LADDER_CASE + ' .xp-root').focus()
await calm.keyboard.press('ArrowDown')
await calm.waitForTimeout(150)
const stillToast = await calm.evaluate((sel) => {
  const root = document.querySelector(sel + ' .xp-root')
  const toast = root.querySelector('.xp-toast')
  if (!toast) return null
  const r = root.getBoundingClientRect()
  const t = toast.getBoundingClientRect()
  return {
    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
    text: toast.textContent,
    opacity: getComputedStyle(toast).opacity,
    dx: Math.round(t.left + t.width / 2 - (r.left + r.width / 2)),
    dy: Math.round(t.top + t.height / 2 - (r.top + r.height / 2)),
  }
}, LADDER_CASE)
check(
  'with reduced motion a toast is shown, and centred',
  !!stillToast && stillToast.reduced && stillToast.opacity === '1' && Math.abs(stillToast.dx) <= 1 && Math.abs(stillToast.dy) <= 1,
  JSON.stringify(stillToast),
)
await calm.waitForTimeout(1200)
check('and it still goes away', (await calm.locator(LADDER_CASE + ' .xp-toast').count()) === 0)
await calm.close()

/* ------------------------------------------------ a menu and its keys */

/*
 * The arrow keys inside an open menu belonged to the player: ArrowDown turned
 * the volume down and ArrowRight seeked, while focus stayed where it was. They
 * move through the rows now, and Left steps back out of a sub-panel. Volume and
 * position are asserted unchanged, because a key that both moved focus and
 * reached the player would pass a focus check alone.
 */
const keys = await browser.newPage({ viewport: { width: 1200, height: 900 } })
await keys.goto(BASE, { waitUntil: 'networkidle' })
await keys.locator('#ladder').scrollIntoViewIfNeeded()
await keys.waitForTimeout(1200)
const menuFocus = () =>
  keys.evaluate(
    ([sel, video]) => {
      const menu = document.querySelector(sel + ' .xp-menu')
      const v = document.querySelector(video)
      const items = menu
        ? [...menu.querySelectorAll('[role^="menuitem"]')].filter((el) => el.getBoundingClientRect().width > 0)
        : []
      return {
        at: items.indexOf(document.activeElement),
        count: items.length,
        back: !!menu?.querySelector('.xp-menu-back'),
        volume: v.volume,
        t: v.currentTime,
      }
    },
    [LADDER_CASE, V],
  )
await keys.locator(LADDER_CASE + ' .xp-root').hover()
await keys.locator(LADDER_CASE + ' .xp-settings .xp-btn').click()
await keys.waitForTimeout(300)
const keysStart = await menuFocus()
const trail = []
for (const key of ['ArrowDown', 'ArrowDown', 'ArrowUp', 'End', 'Home', 'ArrowRight', 'ArrowLeft']) {
  await keys.keyboard.press(key)
  await keys.waitForTimeout(80)
  trail.push((await menuFocus()).at)
}
const last = keysStart.count - 1
check(
  'the arrow keys, Home and End move through an open menu',
  keysStart.count > 1 && trail.join() === [0, 1, 0, last, 0, 0, 0].join(),
  `${keysStart.count} rows, focus went ${trail.join(' ')}`,
)
await keys.keyboard.press('Enter')
await keys.waitForTimeout(250)
const inSpeed = await menuFocus()
await keys.keyboard.press('ArrowDown')
await keys.waitForTimeout(80)
const speedNext = await menuFocus()
await keys.keyboard.press('ArrowLeft')
await keys.waitForTimeout(250)
const backOut = await menuFocus()
check(
  'Left steps back out of a sub-panel',
  inSpeed.back && inSpeed.at === 0 && speedNext.at === 1 && !backOut.back && backOut.at >= 0,
  JSON.stringify({ inSpeed: inSpeed.at, next: speedNext.at, backOut }),
)
check(
  'and none of those keys reached the player',
  backOut.volume === keysStart.volume && backOut.t === keysStart.t,
  `volume ${keysStart.volume} -> ${backOut.volume}, position ${keysStart.t} -> ${backOut.t}`,
)
await keys.close()

/* ------------------------------------ a menu that takes the whole player */

/*
 * From 300px down the menu covers the bar, and the full screen button, being
 * positioned and later in the document, was painted over it - and took the
 * taps meant for the right end of the menu's lowest row.
 */
const coveredBy = []
for (const w of [280, 200]) {
  const small = await browser.newPage({ ...devices['iPhone 13'] })
  await small.goto(BASE, { waitUntil: 'networkidle' })
  await small.evaluate(([sel, px]) => {
    document.querySelector(sel + ' .xp-root').style.width = px + 'px'
  }, [LADDER_CASE, w])
  await small.locator('#ladder').scrollIntoViewIfNeeded()
  await small.waitForTimeout(1000)
  await small.locator(LADDER_CASE + ' .xp-settings .xp-btn').tap()
  await small.waitForTimeout(400)
  coveredBy.push(
    await small.evaluate(
      ([sel, px]) => {
        const root = document.querySelector(sel + ' .xp-root')
        const menu = root.querySelector('.xp-menu')
        const full = root.querySelector('.xp-bar button[aria-label="Full screen"]')
        if (!menu || !full || full.getBoundingClientRect().width === 0) return `${px}px: nothing to test`
        const b = full.getBoundingClientRect()
        const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)
        if (menu.contains(hit)) return ''
        return `${px}px: ${hit?.closest('[aria-label]')?.getAttribute('aria-label') ?? hit?.tagName} on top`
      },
      [LADDER_CASE, w],
    ),
  )
  await small.close()
}
check(
  'at 300px and below the open menu is on top of the bar it covers',
  coveredBy.every((c) => c === ''),
  coveredBy.filter(Boolean).join(', '),
)

/* -------------------------------------- the player never scrolls itself */

/*
 * The playhead layer is the width of the bar and slides by up to its own
 * width, so at the end of a video it reaches a whole player past the right
 * edge. `overflow: hidden` hides that, but it is still a scroll container, so
 * anything that scrolled an element inside into view - focus, scrollIntoView,
 * a screenshot tool - slid the whole player sideways inside its own frame.
 */
const slide = await browser.newPage({ viewport: { width: 1200, height: 900 } })
await slide.goto(BASE, { waitUntil: 'networkidle' })
await slide.locator('#ladder').scrollIntoViewIfNeeded()
await slide.waitForTimeout(1200)
const slid = await slide.evaluate(async (sel) => {
  const root = document.querySelector(sel + ' .xp-root')
  const video = root.querySelector('video.xp-video')
  await new Promise((done) => {
    video.addEventListener('seeked', done, { once: true })
    video.currentTime = video.duration
  })
  await new Promise((done) => setTimeout(done, 200))
  const handle = root.querySelector('.xp-seek-handle')
  const overhang = Math.round(handle.getBoundingClientRect().right - root.getBoundingClientRect().right)
  handle.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  root.scrollLeft = 300
  return { overhang, scrollLeft: root.scrollLeft }
}, LADDER_CASE)
check(
  'nothing inside can scroll the player sideways',
  slid.overhang > 100 && slid.scrollLeft === 0,
  `playhead layer ${slid.overhang}px past the edge, player scrolled ${slid.scrollLeft}px`,
)
await slide.close()

/* ----------------------------------------- the preview at the bar's ends */

/*
 * The preview is centred on the pointer, which near either end of the bar put
 * half of it outside the player - a 170px frame with 85px of it cut off. It is
 * clamped now; in the middle it must still sit on the pointer.
 */
const tipPage = await browser.newPage({ viewport: { width: 1200, height: 900 } })
await tipPage.goto(BASE, { waitUntil: 'networkidle' })
await tipPage.locator('#ladder').scrollIntoViewIfNeeded()
await tipPage.waitForTimeout(1200)
const tipBar = await tipPage.locator(LADDER_CASE + ' .xp-seek').boundingBox()
const tipInside = []
for (const frac of [0.5, 0.003, 0.997]) {
  const x = tipBar.x + tipBar.width * frac
  await tipPage.mouse.move(x, tipBar.y + tipBar.height / 2)
  await tipPage.waitForTimeout(1000)
  tipInside.push(
    await tipPage.evaluate(
      ([sel, px, at]) => {
        const seek = document.querySelector(sel + ' .xp-seek').getBoundingClientRect()
        const el = document.querySelector(sel + ' .xp-seek-tip')
        const tip = el.getBoundingClientRect()
        const frame = el.querySelector('.xp-seek-frame')
        return {
          at,
          frame: !!frame && !frame.hidden,
          w: Math.round(tip.width),
          left: Math.round(tip.left - seek.left),
          right: Math.round(seek.right - tip.right),
          off: Math.round(tip.left + tip.width / 2 - px),
        }
      },
      [LADDER_CASE, x, frac],
    ),
  )
}
check(
  'the frame preview stays inside the bar at both ends',
  tipInside.every((t) => t.frame && t.left >= -1 && t.right >= -1),
  JSON.stringify(tipInside.slice(1)),
)
check(
  'and sits on the pointer in the middle, and against the edge at the ends',
  Math.abs(tipInside[0].off) <= 1 && tipInside[1].left <= 2 && tipInside[2].right <= 2,
  JSON.stringify(tipInside),
)
await tipPage.close()

await browser.close()
if (failures.length) {
  console.error(`\n${failures.length} check(s) failed: ${failures.join(', ')}`)
  process.exit(1)
}
console.log('\nplayer: all checks passed')
