import type { XPlayerRange } from './types'

/**
 * The shortest selection worth having.
 *
 * Two handles that can meet are two handles that can be lost behind each other,
 * and a cut of no length is nothing anyone asked for. A fifth of a second is
 * below what a drag can land on by accident and above a single frame at any
 * frame rate a browser plays.
 */
export const MIN_RANGE = 0.2

/**
 * Puts a dragged selection back inside the rules.
 *
 * `moving` is the handle under the pointer, and it is the one that keeps what
 * it was given: the other is pushed out of its way. That is what makes dragging
 * one end past the other feel like pushing rather than like hitting a wall -
 * until the video itself runs out, where the pushed handle has nowhere to go
 * and the dragged one gives instead.
 */
export function clampRange(range: XPlayerRange, duration: number, moving: 'start' | 'end'): XPlayerRange {
  // A live stream reports Infinity and a video without metadata reports NaN.
  // Neither has anything to select, and neither may leak into the arithmetic.
  if (!Number.isFinite(duration) || duration <= 0) return { start: 0, end: 0 }

  const inside = (value: number) => Math.min(duration, Math.max(0, Number.isFinite(value) ? value : 0))
  let start = inside(range.start)
  let end = inside(range.end)

  // A video shorter than the minimum is selected whole rather than refused.
  const gap = Math.min(MIN_RANGE, duration)
  if (end - start < gap) {
    if (moving === 'start') {
      start = Math.max(0, end - gap)
      end = Math.min(duration, start + gap)
    } else {
      end = Math.min(duration, start + gap)
      start = Math.max(0, end - gap)
    }
  }

  return { start, end }
}
