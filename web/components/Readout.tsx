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
  if (state === 'stalled') return 'text-stall'
  if (state === 'playing') return 'text-ink'
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
    <div aria-hidden className="mt-1.5 h-0.5 w-full overflow-hidden rounded-full bg-line">
      <div
        className={`h-full origin-left ${seconds < STARVED ? 'bg-bad' : 'bg-ink'}`}
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
 *
 * Labels are words and set like words; the values are readings and stay in the
 * mono face, so a digit changing does not shuffle the ones beside it.
 *
 * Sizes answer to the panel's width (it is a size container), not the
 * viewport's. On a short laptop screen the panels narrow by height, and the
 * viewport-width sizes set "stalled" 63px wide in a 39px column, over the time.
 * The full size needs about 22rem of panel for its three columns. A value that
 * still will not fit - an error name - breaks rather than running into the next
 * column.
 */
export function Readout({ reading }: { reading: Reading }) {
  const starved = reading.ahead < STARVED
  const label = 'truncate text-[0.6875rem] text-muted @min-[22rem]:text-micro'
  const value = 'mt-0.5 font-mono text-[0.6875rem] tabular-nums [overflow-wrap:anywhere] @min-[22rem]:text-body'
  return (
    <dl className="mt-2 grid grid-cols-3 gap-2 border-t border-line pt-2 @min-[22rem]:mt-2.5 @min-[22rem]:gap-4 @min-[22rem]:pt-2.5">
      <div className="min-w-0">
        <dt className={label}>State</dt>
        <dd className={`${value} ${toneFor(reading.state)}`}>
          {reading.error ? `${STATE_LABEL.error} · ${reading.error}` : STATE_LABEL[reading.state]}
        </dd>
      </div>
      <div className="min-w-0">
        <dt className={label}>Time</dt>
        <dd className={`${value} text-ink`}>{clock(reading.time)}</dd>
      </div>
      <div className="min-w-0">
        {/*
          The explanation was a title attribute, which touch and keyboard users
          never get. It is said out loud instead, and the visible label stays
          short because the column is about 50px wide on a phone.
        */}
        <dt className={label}>
          Ahead
          <span className="sr-only"> — seconds of video ready to play beyond this point</span>
        </dt>
        <dd className={`${value} ${starved ? 'text-bad' : 'text-ink'}`}>{reading.ahead.toFixed(1)}s</dd>
        <AheadGauge seconds={reading.ahead} />
      </div>
    </dl>
  )
}
