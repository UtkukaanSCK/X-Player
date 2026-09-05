import { useCallback, useEffect, useRef, type RefObject } from 'react'
import { formatTime, spokenTime } from '../format'

export interface SeekRefs {
  root: RefObject<HTMLDivElement | null>
  played: RefObject<HTMLDivElement | null>
  buffered: RefObject<HTMLDivElement | null>
  handle: RefObject<HTMLDivElement | null>
}

/**
 * Smallest change in position worth drawing.
 *
 * The bar is a fraction of a screen wide, so a ratio settled to one part in
 * ten thousand cannot move it or the handle by a visible amount - on a 1000px
 * bar that is a tenth of a pixel. Long videos are what this is for: two hours
 * at sixty frames a second advances the ratio by two millionths per frame, so
 * without a step the loop writes the same picture hundreds of times before it
 * changes.
 */
const STEP = 1e4

interface Options {
  videoRef: RefObject<HTMLVideoElement | null>
  refs: SeekRefs
  timeLabelRef: RefObject<HTMLSpanElement | null>
  /** While the viewer drags, the position comes from the pointer, not the video. */
  seekingRef: RefObject<boolean>
  playing: boolean
}

export interface ProgressPaint {
  /** Draw the video's own position. */
  paint: () => void
  /** Draw a position the viewer is dragging to, before the video has moved. */
  drawRatio: (ratio: number, duration: number) => void
}

/**
 * Everything that draws the playhead, in one place.
 *
 * Two rules hold it together. Nothing here goes through React - the loop runs
 * every frame and state would re-render the whole bar. And nothing is written
 * twice: each sink remembers what it last received, because a value that has
 * not changed is not worth the write.
 *
 * That second rule is not only about cost. `aria-valuenow` and `aria-valuetext`
 * describe a position that changes once a second, and rewriting them sixty
 * times a second told assistive technology the slider had moved when it had
 * not.
 */
export function useProgressPaint({ videoRef, refs, timeLabelRef, seekingRef, playing }: Options): ProgressPaint {
  /* -1 is a value no sink can legitimately hold, so the first write always lands. */
  const last = useRef({ position: -1, buffered: -1, second: -1 })

  const drawRatio = useCallback(
    (ratio: number, duration: number) => {
      const position = Math.round(ratio * STEP)
      if (position !== last.current.position) {
        last.current.position = position
        const value = position / STEP
        if (refs.played.current) refs.played.current.style.transform = `scaleX(${value})`
        if (refs.handle.current) refs.handle.current.style.left = `${value * 100}%`
      }

      /*
       * A live stream reports a duration of Infinity, and neither a rounded
       * second nor a spoken time means anything until that is settled.
       */
      const seconds = Number.isFinite(ratio * duration) ? ratio * duration : 0

      /*
       * One second, told three ways, so it had better be one second. The
       * visible clock floors, and rounding the slider on top of that made the
       * number say "1" while the words beside it said "0 seconds" - the same
       * instant, described two ways, to the same person.
       */
      const second = Math.floor(seconds)
      if (second !== last.current.second) {
        last.current.second = second
        const root = refs.root.current
        if (root) {
          root.setAttribute('aria-valuenow', String(second))
          // Spoken, not a clock face: a screen reader reads "1:05" as digits.
          root.setAttribute('aria-valuetext', spokenTime(second))
        }
        const node = timeLabelRef.current
        if (node) node.textContent = formatTime(second)
      }
    },
    [refs, timeLabelRef],
  )

  const paint = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    const duration = video.duration
    if (!Number.isFinite(duration) || duration <= 0) return

    if (!seekingRef.current) drawRatio(Math.min(1, video.currentTime / duration), duration)

    /* How far the range we are currently inside reaches. */
    let end = 0
    const ranges = video.buffered
    for (let i = 0; i < ranges.length; i += 1) {
      if (ranges.start(i) <= video.currentTime + 0.25 && ranges.end(i) > end) end = ranges.end(i)
    }
    const buffered = Math.round(Math.min(1, end / duration) * STEP)
    if (buffered !== last.current.buffered) {
      last.current.buffered = buffered
      if (refs.buffered.current) refs.buffered.current.style.transform = `scaleX(${buffered / STEP})`
    }
  }, [videoRef, refs, seekingRef, drawRatio])

  /* While playing, redraw every frame; otherwise once, on whatever just changed. */
  useEffect(() => {
    if (!playing) {
      paint()
      return
    }
    let frame = 0
    const tick = () => {
      paint()
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, paint])

  return { paint, drawRatio }
}
