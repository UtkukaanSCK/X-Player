'use client'

import { useCallback, useRef, useState } from 'react'
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { XPlayer } from 'x-player'
import 'x-player/style.css'
import { useNetworkSim, type NetworkMode } from '@/hooks/useNetworkSim'
import { useFrugalConnection } from '@/hooks/useFrugalConnection'
import { useReading } from '@/hooks/useReading'
import { withBase } from '@/lib/site'
import { ProofHeading } from './ProofHeading'
import { Readout } from './Readout'

/*
 * Two minutes, looped from the brightest three seconds of the source.
 *
 * Two decisions, both learned the hard way. Length first: a fourteen second
 * clip is fully buffered within a second of pressing play, so cutting the
 * connection afterwards has nothing left to cut and both players sail to the
 * end regardless.
 *
 * And brightness. The Sintel excerpt fades to black for whole seconds at a
 * time, so an earlier version of this clip regularly left both panels showing
 * nothing at all - which reads as two broken players rather than as a
 * comparison. A looping window costs some variety and buys a picture that is
 * always visibly either moving or frozen.
 */
const CLIP = withBase('/media/demo-long.mp4')
const POSTER = withBase('/media/demo.jpg')

/*
 * The rates are the worker's own, not approximations of them.
 *
 * The clip needs 48 kB/s; this list said 50, which is the kind of small
 * discrepancy that costs a page its credibility on the one claim it is making.
 * The id stays `slow3g` because the worker and its stored mode use it, and
 * renaming a persisted value to tidy a label is not worth the migration.
 */
const MODES: { id: NetworkMode; label: string; detail: string }[] = [
  { id: 'normal', label: 'Normal', detail: '70 kB/s — comfortably above the 48 kB/s the clip needs' },
  { id: 'slow3g', label: 'Slow 2G', detail: '16 kB/s — a third of what the clip needs, to both of them' },
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
    'Both crawl, at the same rate, and both show they are waiting. No player can pull a 48 kB/s clip through a link a third that wide, and this one does not pretend to. Watch the buffer figures fall towards zero.',
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
   * The cache is no longer a problem either: two minutes of video is far more
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
   * Two players streaming the same two-minute clip is what the comparison is;
   * it cannot be made cheap without making it dishonest, since a clip small
   * enough to be cheap is one a throttle cannot starve. So on a link that has
   * asked to be spent carefully the apparatus is built and left waiting, and
   * the visitor decides. Everyone else sees it run exactly as before.
   */
  const frugal = useFrugalConnection()
  const [consented, setConsented] = useState(false)
  const holding = frugal && !consented
  const src = ready && !holding ? CLIP : undefined

  /** Once someone picks a condition themselves, scrolling stops overriding it. */
  const manual = useRef(false)
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

  // Scrolling through the section degrades the connection. This is the Apple
  // trick - scroll position drives state rather than merely revealing content -
  // and here the state it drives is a real one.
  useMotionValueEvent(scrollYProgress, 'change', (progress) => {
    if (manual.current || status.kind !== 'ready') return
    change(progress < 0.45 ? 'normal' : 'slow3g')
  })

  // Settles as the section pins, then holds. It does not fade out: once the
  // sticky viewport lets go, the comparison simply scrolls away like anything
  // else, and the next section is already rising to meet it.
  const stageScale = useTransform(scrollYProgress, [0, 0.12], reduced ? [1, 1] : [0.94, 1])
  const stageY = useTransform(scrollYProgress, [0, 0.12], reduced ? [0, 0] : [40, 0])

  const bareReading = useReading(useCallback(() => bareRef.current, []))
  const playerReading = useReading(useCallback(() => playerVideo, [playerVideo]))

  const current = MODES.find((m) => m.id === mode) ?? MODES[0]

  return (
    <section ref={container} id="proof" aria-labelledby="proof-heading" className="relative h-[200svh]">
      <div className="sticky top-0 flex h-svh flex-col justify-center gap-5 overflow-hidden px-5 py-5 sm:px-8">
        <ProofHeading />

        <motion.div
          data-stage="proof"
          style={{ scale: stageScale, y: stageY }}
          className="mx-auto flex w-full max-w-6xl min-h-0 flex-col gap-2.5 sm:gap-3.5"
        >
          {/* Never stacked. The argument is watching both at the same instant;
              one above the other is two videos, not a comparison. */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4">
            <Panel
              id="panel-bare"
              title="A plain <video>"
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
                  src={src}
                  poster={POSTER}
                  muted
                  autoPlay
                  rememberPosition={false}
                  // Names the player's own region, which otherwise reads as the
                  // generic "Video player" beside a panel that says X-Player.
                  title="X-Player"
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
                manual.current = true
                change(next)
              }}
            />
          )}

          {!holding && (
            <p
              key={mode}
              className="mx-auto max-w-3xl text-center text-body leading-relaxed text-muted sm:text-lead"
              aria-live="polite"
            >
              {VERDICT[mode]}
            </p>
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
  title: string
  subtitle: string
  tone: 'good' | 'bad'
  reading: ReturnType<typeof useReading>
  children: React.ReactNode
}) {
  const failing = reading.state === 'error' || reading.state === 'stalled'
  const accent = tone === 'good' ? 'text-good' : 'text-muted'

  /*
   * Named as a group, because the whole point is which reading belongs to which
   * player. Without this a screen reader meets two identical runs of "STATE
   * playing, TIME 0:04, AHEAD 3.1s" with nothing to say whose is whose - and
   * "whose is whose" is the entire argument of the section.
   */
  return (
    <div
      data-panel={tone}
      role="group"
      aria-labelledby={id}
      className={`overflow-hidden rounded-xl border bg-panel transition-colors duration-500 ${
        failing && tone === 'bad' ? 'border-bad/50' : 'border-line'
      }`}
    >
      <div className="flex items-baseline justify-between gap-3 border-b border-line px-2.5 py-2 sm:px-3.5 sm:py-2.5">
        <h2 id={id} className={`font-mono text-micro tracking-[0.04em] ${accent}`}>
          {title}
        </h2>
        <p className="hidden truncate text-micro text-muted sm:block">{subtitle}</p>
      </div>
      <div className="aspect-video w-full bg-black">{children}</div>
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
        className="mx-auto max-w-2xl rounded-lg border border-bad/40 bg-bad/5 px-4 py-3 text-center text-caption text-paper"
      >
        The connection cannot be throttled here, so there is nothing honest to show. {unavailable}
      </p>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-2">
      <div
        role="radiogroup"
        aria-label="Connection"
        className="flex w-full gap-1 rounded-lg border border-line bg-panel p-1"
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
              className={`flex-1 min-h-11 rounded-md px-3 py-2 font-mono text-caption transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-good disabled:opacity-40 ${
                on ? 'bg-good/15 text-good' : 'text-muted hover:bg-raised hover:text-paper active:bg-line'
              }`}
            >
              {m.label}
            </button>
          )
        })}
      </div>
      {/* The reading is a number and stays monospaced; the sentence explaining
          where it comes from is prose and is set like prose. */}
      <p role="status" className="text-center font-mono text-micro leading-relaxed text-muted">
        {pending ? 'starting the throttle…' : detail}
      </p>
      <p className="mx-auto max-w-md text-center text-caption leading-relaxed text-muted">
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
        className="min-h-11 rounded-lg bg-good px-6 py-3 text-body font-semibold text-[#1a1206] transition-colors hover:bg-[#ffc04a] active:bg-[#e59a17] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-good"
      >
        Play the comparison
      </button>
      <p className="max-w-md text-caption leading-relaxed text-muted">
        It streams the same two-minute clip to both players, about 12 MB. Your browser said this
        connection should be spent carefully, so it is waiting for you.
      </p>
    </div>
  )
}
