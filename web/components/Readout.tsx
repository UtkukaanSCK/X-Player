'use client'

import type { Reading } from '@/hooks/useReading'

const STATE_LABEL: Record<Reading['state'], string> = {
  idle: 'idle',
  playing: 'playing',
  stalled: 'stalled',
  paused: 'paused',
  ended: 'ended',
  error: 'dead',
}

function toneFor(state: Reading['state']) {
  if (state === 'error') return 'text-bad'
  if (state === 'stalled') return 'text-good'
  if (state === 'playing') return 'text-paper'
  return 'text-muted'
}

const clock = (seconds: number) => {
  const total = Math.max(0, Math.floor(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** Under half a second of buffer is a stall about to happen. */
const STARVED = 0.5
/** The window the gauge draws. Past this a player is simply fine. */
const GAUGE_SECONDS = 10

/**
 * Buffer health as a bar, because the whole argument is a comparison.
 *
 * The two numbers are the evidence, but reading "3.1s" and "0.4s" and taking
 * the difference is work the page can do for the reader. A length is compared
 * at a glance; two figures are not.
 *
 * It draws the first ten seconds and stops. Buffer runs to a minute or more on
 * a healthy link, and a bar scaled to that leaves everything interesting
 * squeezed into its first millimetre - ten seconds is the range where the
 * answer is still in doubt. The exact figure sits beside it either way, and
 * nothing here is animated: it steps when the reading steps.
 */
function AheadGauge({ seconds }: { seconds: number }) {
  const ratio = Math.max(0, Math.min(1, seconds / GAUGE_SECONDS))
  return (
    <div aria-hidden className="mt-1.5 h-0.5 w-full overflow-hidden bg-line">
      <div
        className={`h-full origin-left ${seconds < STARVED ? 'bg-bad' : 'bg-paper'}`}
        style={{ transform: `scaleX(${ratio})` }}
      />
    </div>
  )
}

/**
 * The live numbers under each player.
 *
 * These are read off the video element roughly three times a second and printed
 * as they are. The whole comparison rests on them being real, so nothing here is
 * smoothed, delayed or rounded into looking better than it is.
 */
export function Readout({ reading }: { reading: Reading }) {
  const starved = reading.ahead < STARVED
  return (
    <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-b-xl border-t border-line bg-line font-mono text-micro">
      <div className="bg-panel px-2 py-1.5 sm:px-3 sm:py-2.5">
        <dt className="truncate text-muted uppercase tracking-[0.08em] sm:tracking-[0.12em]">State</dt>
        <dd className={`mt-0.5 sm:mt-1 sm:text-body ${toneFor(reading.state)}`}>
          {reading.error ? `${STATE_LABEL.error} · ${reading.error}` : STATE_LABEL[reading.state]}
        </dd>
      </div>
      <div className="bg-panel px-2 py-1.5 sm:px-3 sm:py-2.5">
        <dt className="truncate text-muted uppercase tracking-[0.08em] sm:tracking-[0.12em]">Time</dt>
        <dd className="mt-0.5 tabular-nums text-paper sm:mt-1 sm:text-body">{clock(reading.time)}</dd>
      </div>
      <div className="bg-panel px-2 py-1.5 sm:px-3 sm:py-2.5">
        {/*
          The explanation was a title attribute, which touch and keyboard users
          never get. It is said out loud instead, and the visible label stays
          short because the column is 52px wide on a phone.
        */}
        <dt className="truncate text-muted uppercase tracking-[0.08em] sm:tracking-[0.12em]">
          Ahead
          <span className="sr-only"> — seconds of video ready to play beyond this point</span>
        </dt>
        <dd className={`mt-0.5 tabular-nums sm:mt-1 sm:text-body ${starved ? 'text-bad' : 'text-paper'}`}>
          {reading.ahead.toFixed(1)}s
        </dd>
        <AheadGauge seconds={reading.ahead} />
      </div>
    </dl>
  )
}
