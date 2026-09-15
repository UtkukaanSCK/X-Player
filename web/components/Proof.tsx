'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { XPlayer } from 'x-player'
import 'x-player/style.css'
import { useNetworkSim, type NetworkMode } from '@/hooks/useNetworkSim'
import { useFrugalConnection } from '@/hooks/useFrugalConnection'
import { REVEAL_EASE, useRevealProgress } from '@/lib/reveal'
import { useReading } from '@/hooks/useReading'
import { withBase } from '@/lib/site'
import { ProofHeading } from './ProofHeading'
import { Readout } from './Readout'

/*
 * Two minutes of Big Buck Bunny, chosen so neither panel ever goes black.
 *
 * Two constraints, both learned the hard way; public/media/CREDITS.md has the
 * measurements. Length: a short clip is fully buffered within a second of
 * pressing play, so cutting the connection afterwards has nothing left to cut
 * and both players sail to the end regardless. Brightness: an earlier source
 * faded to black between shots, which left both panels showing nothing - and
 * that reads as two broken players rather than as a comparison.
 */
const CLIP = withBase('/media/demo-long.mp4')
const SMALL_CLIP = withBase('/media/demo-480.mp4')
const POSTER = withBase('/media/demo.jpg')

/*
 * The rates are the worker's own, not approximations of them.
 *
 * The clip needs 24 kB/s; an earlier list said 50 against a clip that needed
 * discrepancy that costs a page its credibility on the one claim it is making.
 * The id stays `slow3g` because the worker and its stored mode use it, and
 * renaming a persisted value to tidy a label is not worth the migration.
 */
const MODES: { id: NetworkMode; label: string; detail: string }[] = [
  { id: 'normal', label: 'Normal', detail: '34 kB/s — comfortably above the 24 kB/s the clip needs' },
  { id: 'slow3g', label: 'Slow 2G', detail: '8 kB/s — a third of what the clip needs, to both of them' },
]

/**
 * What each condition actually does, measured rather than imagined.
 *
 * Neither sentence claims one player beats the other, because on these two
 * settings neither does. They crawl at the same rate and both show they are
 * waiting. Writing anything stronger would be a claim anyone could disprove by
 * watching the two panels for ten seconds.
 */
const VERDICT: Record<NetworkMode, string> = {
  normal: 'Both play. Same file, same speed, same result - as you would hope.',
  slow3g:
    'Both crawl, at the same rate, and both show they are waiting. No player can pull a 24 kB/s clip through a link a third that wide, and this one does not pretend to. Watch the buffer figures fall towards zero.',
}

export function Proof() {
  const container = useRef<HTMLDivElement>(null)
  const bareRef = useRef<HTMLVideoElement>(null)
  const [playerVideo, setPlayerVideo] = useState<HTMLVideoElement | null>(null)

  const { mode, status, setMode } = useNetworkSim()
  const reduced = useReducedMotion()

  /*
   * Nothing is ever remounted. The connection degrades underneath two players
   * that are already running, which is the only version of this worth showing.
   *
   * An earlier draft started both players afresh on every change. That turned
   * out to be the reason the plain video looked so bad: handed a starved link
   * from byte zero it never gathered enough to begin, so it sat at 0:00 while
   * the other limped along. Impressive, and not true. Letting both build a
   * buffer at full speed first and then taking the connection away is both
   * fairer and closer to what happens to someone on a train.
   *
   * The cache is no longer a problem either: this much video is far more
   * than gets buffered, so there is always more to fetch and the worker always
   * has something to throttle.
   *
   * Nothing loads until the worker is actually in control. A media element
   * fetches the whole file as one long-lived response, and a response that
   * started before the worker claimed the page never passes through it at all -
   * which is how both players ended up with the entire clip buffered and every
   * throttle setting doing nothing. The apparatus goes in before the experiment
   * starts.
   */
  const ready = status.kind === 'ready'

  /*
   * Twelve megabytes is not spent on a metered connection without asking.
   *
   * Two players streaming the same clip is what the comparison is;
   * it cannot be made cheap without making it dishonest, since a clip small
   * enough to be cheap is one a throttle cannot starve. So on a link that has
   * asked to be spent carefully the apparatus is built and left waiting, and
   * the visitor decides. Everyone else sees it run exactly as before.
   */
  const frugal = useFrugalConnection()
  const [consented, setConsented] = useState(false)
  const holding = frugal && !consented
  /*
   * One encode for everyone, sized for the box that matters most.
   *
   * The comparison box is about 170x96 CSS px on a 390px phone, which on a
   * DPR 3 screen is 510x288 real pixels - so 854x480 was oversampled even for
   * retina, and a phone was decoding about three times the pixels its box
   * could show, twice over.
   *
   * I tried giving each layout the encode its own box wanted, and it cannot
   * work: the three figures on screen are all ratios against one clip's
   * bitrate, and two clips means one of them is being described by numbers
   * belonging to the other. A wide layout playing the 50 kB/s file under a
   * caption promising 24 would also be starved by the "comfortable" rate,
   * which is the demonstration failing rather than a cosmetic mismatch.
   *
   * So both get the small one and the large one stays in the quality menu.
   * The cost is honest and worth naming: a desktop box up to 560px wide shows
   * a 480x270 source, which is soft on a retina laptop. The page is about how
   * a player behaves on a bad connection, and the phone it behaves worst on is
   * the one that could not decode it.
   */
  const renditions = useMemo(
    () => [
      { src: SMALL_CLIP, label: "270p" },
      { src: CLIP, label: "360p" },
    ],
    [],
  )
  const src = ready && !holding ? renditions[0].src : undefined

  const applied = useRef<NetworkMode>('normal')

  const change = useCallback(
    (next: NetworkMode) => {
      if (applied.current === next) return
      applied.current = next
      setMode(next)
    },
    [setMode],
  )

  const { scrollYProgress } = useScroll({ target: container, offset: ['start start', 'end end'] })

  const progress = useRevealProgress(scrollYProgress, !reduced)

  /* How much of the section the stage takes to settle. Wider than it was: an
     eased curve spends its travel early, so the same 0.12 finished in a fifth
     of a screen and read as a jump. */
  const SETTLE = 0.2

  /*
   * Settles as the section pins, then holds. It does not fade out: once the
   * sticky viewport lets go, the comparison simply scrolls away like anything
   * else, and the next section is already rising to meet it.
   *
   * A smaller settle than it once was - 0.96 and 24px rather than 0.94 and
   * 40px - because on a white page the videos are the only dark shapes, and
   * a large movement of the two darkest things on screen reads as a jolt.
   *
   * The connection used to be driven from here too - scrolling past the
   * halfway mark switched the comparison to Slow 2G on its own. It read as the
   * page changing its own demonstration under the reader, and it meant nobody
   * could look at the throttled case without the page deciding when. The two
   * buttons are the only thing that changes it now.
   */
  const stageScale = useTransform(progress, [0, SETTLE], reduced ? [1, 1] : [0.96, 1], {
    ease: REVEAL_EASE,
  })
  const stageY = useTransform(progress, [0, SETTLE], reduced ? [0, 0] : [24, 0], { ease: REVEAL_EASE })

  const bareReading = useReading(useCallback(() => bareRef.current, []))
  const playerReading = useReading(useCallback(() => playerVideo, [playerVideo]))

  /*
   * Nothing decodes where nobody can see it.
   *
   * Scrolled past the section on a phone, the plain <video> stopped on its
   * own and the player's did not: 3.2s frozen against 6.2 climbing to 8.1
   * over ten seconds. That difference is a browser heuristic rather than
   * anyone's decision, and a comparison whose two halves behave differently
   * the moment nobody is watching is not a comparison. Both stop here, and
   * both start again together, which is the same reason they share a start
   * mechanism in the first place.
   *
   * This saves a decode and not a byte: measured off-screen, the buffers went
   * on filling from cache and no further bytes arrived at all. On a phone the
   * decode is the expensive half anyway.
   *
   * The section is the thing observed, not the players. It is 200svh with a
   * sticky interior, so the players are on screen for the whole of it; they
   * are only gone once the section itself is.
   */
  const [watching, setWatching] = useState(true)

  useEffect(() => {
    const section = container.current
    if (!section || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setWatching(entry.isIntersecting), {
      threshold: 0,
    })
    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    // No source means the metered gate is still holding; there is nothing to play.
    if (!src) return
    for (const video of [bareRef.current, playerVideo]) {
      if (!video) continue
      if (watching) void video.play().catch(() => {})
      else video.pause()
    }
  }, [watching, playerVideo, src])

  const current = MODES.find((m) => m.id === mode) ?? MODES[0]

  return (
    <section
      ref={container}
      id="proof"
      aria-labelledby="proof-heading"
      className="relative h-[200svh] short:h-auto"
    >
      {/*
        The top padding clears the site header, which sits over this part of the
        page; the heading and the comparison are centred in the height left
        below it. The column's width is capped by that height too - see
        .proof-column - so the whole of it fits a laptop screen.

        On a screen too short for that (the `short` variant, in globals.css) the
        section stops pinning and scrolls like the rest of the page instead of
        cutting its own bottom off.
      */}
      <div className="sticky top-0 flex h-svh flex-col justify-center gap-5 overflow-hidden px-5 pb-5 pt-16 sm:gap-7 sm:px-8 sm:pb-6 sm:pt-20 short:static short:h-auto short:overflow-visible">
        <ProofHeading />

        <motion.div
          data-stage="proof"
          style={{ scale: stageScale, y: stageY }}
          className="proof-column flex min-h-0 flex-col gap-4"
        >
          {/* Never stacked. The argument is watching both at the same instant;
              one above the other is two videos, not a comparison. */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:gap-6">
            <Panel
              id="panel-bare"
              title={
                <>
                  A plain <span className="font-mono text-[0.92em]">&lt;video&gt;</span>
                </>
              }
              subtitle="What most sites ship"
              tone="bad"
              reading={bareReading}
            >
              <video
                ref={bareRef}
                // The other side announces itself as "Video player"; without a
                // name of its own this one is just "video", and the two are
                // indistinguishable to anyone not looking at the screen.
                aria-label="A plain video element"
                className="h-full w-full bg-black object-contain"
                src={src}
                poster={POSTER}
                controls
                muted
                // The browser's own attribute rather than a canplay listener:
                // the listener raced the event and lost, leaving this side dark
                // while the other played. It is also the same mechanism the
                // other player uses, which keeps the two starts comparable.
                autoPlay
                playsInline
                preload="metadata"
              />
            </Panel>

            <Panel
              id="panel-xplayer"
              title="X-Player"
              subtitle="The same file, the same link"
              tone="good"
              reading={playerReading}
            >
              <div className="stage-player h-full w-full">
                <XPlayer
                  src={undefined}
                  sources={src ? renditions : undefined}
                  poster={POSTER}
                  muted
                  autoPlay
                  rememberPosition={false}
                  // Names the player's own region, which otherwise reads as the
                  // generic "Video player" beside a panel that says X-Player.
                  title="X-Player"
                  // The player's own accent, and the brand's. It is drawn inside
                  // the footage; apart from the mark in the header it is the only
                  // colour the page itself shows.
                  accent="#ffb020"
                  onReady={(video) => setPlayerVideo(video)}
                />
              </div>
            </Panel>
          </div>

          {holding ? (
            <Consent onStart={() => setConsented(true)} />
          ) : (
            <Controls
              mode={mode}
              detail={current.detail}
              unavailable={status.kind === 'unavailable' ? status.reason : null}
              pending={status.kind === 'pending'}
              onPick={(next) => {
                change(next)
              }}
            />
          )}

          {!holding && (
            /*
             * One height for both verdicts, and one live region for both.
             *
             * Normal's verdict is one line and Slow 2G's is three, so the column
             * changed height when the mode changed, and the column's height is
             * what decides whether the pinned section fits the screen: sized for
             * Normal, it cut Slow 2G's last line off on a laptop. The longer
             * sentence now sits invisibly in the same grid cell and holds the
             * space in both modes.
             *
             * The visible sentence is one element that stays mounted while its
             * text changes. It used to be keyed by mode, which rebuilt the live
             * region with its text already inside - the case that is usually
             * announced by nothing at all.
             */
            <div className="mx-auto grid max-w-2xl text-center text-body leading-relaxed text-pretty text-muted sm:text-lead">
              <p aria-hidden className="invisible col-start-1 row-start-1">
                {VERDICT.slow3g}
              </p>
              <p className="col-start-1 row-start-1" aria-live="polite">
                {VERDICT[mode]}
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </section>
  )
}

/* --------------------------------------------------------------------- parts */

function Panel({
  id,
  title,
  subtitle,
  tone,
  reading,
  children,
}: {
  id: string
  title: React.ReactNode
  subtitle: string
  tone: 'good' | 'bad'
  reading: ReturnType<typeof useReading>
  children: React.ReactNode
}) {
  /*
   * The frame marks trouble the same way on both sides.
   *
   * It used to ring the plain video alone, in the error colour, whenever it
   * stalled - while the sentence under the panels says, correctly, that both
   * players stall at the same rate. A ring on one side contradicted that. A
   * stall now gets a quiet ring on whichever panel is stalling, and only a
   * real error gets the red one.
   */
  const ring =
    reading.state === 'error'
      ? 'ring-2 ring-bad ring-offset-2 ring-offset-ground'
      : reading.state === 'stalled'
        ? 'ring-1 ring-stall/70 ring-offset-2 ring-offset-ground'
        : ''

  /*
   * Named as a group, because the whole point is which reading belongs to which
   * player. Without this a screen reader meets two identical runs of "State
   * playing, Time 0:04, Ahead 3.1s" with nothing to say whose is whose - and
   * "whose is whose" is the entire argument of the section.
   *
   * No card around it. The frame is the video, and the caption and readings sit
   * underneath it the way a caption sits under a picture; a border around all
   * three would be a second frame saying the same thing as the first.
   *
   * A size container, because the panel's width no longer follows the
   * viewport's: on a short screen the column narrows by height. Text sizes and
   * the subtitle answer to the panel itself, which is what they have to fit.
   */
  return (
    <div data-panel={tone} role="group" aria-labelledby={id} className="@container flex min-w-0 flex-col">
      <div className={`aspect-video w-full overflow-hidden rounded-lg bg-black transition-shadow duration-500 ${ring}`}>
        {children}
      </div>
      <div className="mt-2.5 flex items-baseline justify-between gap-3 @min-[20rem]:mt-3">
        <h2 id={id} className="truncate text-caption font-medium text-ink @min-[18rem]:text-body">
          {title}
        </h2>
        <p className="hidden truncate text-caption text-muted @min-[26rem]:block">{subtitle}</p>
      </div>
      <Readout reading={reading} />
    </div>
  )
}

function Controls({
  mode,
  detail,
  unavailable,
  pending,
  onPick,
}: {
  mode: NetworkMode
  detail: string
  unavailable: string | null
  pending: boolean
  onPick: (mode: NetworkMode) => void
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([])

  /*
   * Arrow keys move and choose, and only the chosen option is a tab stop.
   *
   * This is what `role="radiogroup"` promises, and two independently tabbable
   * buttons is not it: a keyboard user expects one stop for the group and the
   * arrows to pick within it, and assistive technology in forms mode assumes
   * the same. Clicking is unaffected.
   */
  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown'
    const back = event.key === 'ArrowLeft' || event.key === 'ArrowUp'
    if (!forward && !back) return
    event.preventDefault()
    const next = (index + (forward ? 1 : -1) + MODES.length) % MODES.length
    buttons.current[next]?.focus()
    onPick(MODES[next].id)
  }

  if (unavailable) {
    // No quiet fallback to a staged demonstration: if the connection cannot
    // really be degraded, the page says so and offers nothing to press.
    return (
      <p
        role="alert"
        className="mx-auto max-w-2xl rounded-lg border border-bad/30 bg-bad/5 px-4 py-3 text-center text-caption text-ink"
      >
        The connection cannot be throttled here, so there is nothing honest to show. {unavailable}
      </p>
    )
  }

  return (
    // Wider than the control itself, so the sentence under it can stay on one
    // line on a laptop; the control keeps its own narrower cap.
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-2.5">
      {/*
        A segmented control, and the chosen side is filled in ink. A tint or a
        hairline would be the quieter choice, and also one that measures well
        under the 3:1 a selected state needs to be seen at all.
      */}
      <div
        role="radiogroup"
        aria-label="Connection"
        className="grid w-full max-w-xl grid-cols-2 gap-1 rounded-xl bg-panel p-1"
      >
        {MODES.map((m, index) => {
          const on = mode === m.id
          return (
            <button
              key={m.id}
              ref={(node) => {
                buttons.current[index] = node
              }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              disabled={pending}
              onClick={() => onPick(m.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={`min-h-12 rounded-lg px-3 py-2 text-body font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-40 ${
                on ? 'bg-ink text-white' : 'text-muted hover:bg-raised hover:text-ink active:bg-line'
              }`}
            >
              {m.label}
            </button>
          )
        })}
      </div>
      <p role="status" className="text-center text-caption tabular-nums leading-relaxed text-muted">
        {pending ? 'Starting the throttle…' : detail}
      </p>
      {/* One line on a laptop rather than two: every line in this column is
          height the two videos above it cannot have. */}
      <p className="mx-auto max-w-3xl text-center text-caption leading-relaxed text-pretty text-muted">
        This page throttles its own connection with a service worker. Both players get the same bytes at the
        same moment.
      </p>
    </div>
  )
}

/**
 * Shown instead of the controls when the connection has asked for restraint.
 *
 * It says the number rather than hiding it. A page whose whole argument is
 * that it tells you what is happening cannot quietly spend twelve megabytes
 * and then explain itself afterwards.
 */
function Consent({ onStart }: { onStart: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-3 text-center">
      <button
        type="button"
        onClick={onStart}
        className="min-h-12 rounded-lg bg-ink px-6 py-3 text-body font-medium text-white transition-colors hover:bg-ink-hover active:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        Play the comparison
      </button>
      <p className="max-w-md text-caption leading-relaxed text-muted">
        It streams the same clip to both players, about 6 MB. Your browser said this
        connection should be spent carefully, so it is waiting for you.
      </p>
    </div>
  )
}
