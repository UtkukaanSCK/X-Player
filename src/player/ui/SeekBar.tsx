import { useCallback, useRef, useState, type RefObject } from 'react'
// The tooltip is read, so it stays a clock face; the ARIA value is heard, so
// it becomes words - and that one lives in the painter, with the other sinks.
import { formatTime } from '../format'
import type { SeekRefs } from '../hooks/useProgressPaint'

export type { SeekRefs }

/** Beyond this the press is a drag, and the tooltip follows without seeking. */
const SCRUB_INTERVAL_MS = 120

interface Props {
  refs: SeekRefs
  duration: number
  /** While dragging, the rAF loop stops reading the video's position. */
  seekingRef: RefObject<boolean>
  /** Draws a dragged-to position. The same painter the play loop uses. */
  drawRatio: (ratio: number, duration: number) => void
  onSeek: (seconds: number) => void
  onScrub: (seconds: number) => void
  onActivity: () => void
}

/**
 * The progress bar. Dragging never touches React state for the position: the
 * bar and the handle are written straight to the DOM, so no frames are dropped.
 */
export function SeekBar({ refs, duration, seekingRef, drawRatio, onSeek, onScrub, onActivity }: Props) {
  const [hover, setHover] = useState<{ x: number; time: number } | null>(null)
  const draggingRef = useRef(false)
  const lastScrubRef = useRef(0)

  const ratioAt = useCallback(
    (clientX: number) => {
      const el = refs.root.current
      if (!el) return 0
      const { left, width } = el.getBoundingClientRect()
      if (width === 0) return 0
      return Math.min(1, Math.max(0, (clientX - left) / width))
    },
    [refs.root],
  )

  const beginDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!duration) return
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      draggingRef.current = true
      seekingRef.current = true
      const ratio = ratioAt(e.clientX)
      drawRatio(ratio, duration)
      onScrub(ratio * duration)
      lastScrubRef.current = performance.now()
      onActivity()
    },
    [duration, ratioAt, drawRatio, onScrub, seekingRef, onActivity],
  )

  const trackPointer = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!duration) return
      const ratio = ratioAt(e.clientX)
      setHover({ x: ratio, time: ratio * duration })
      if (!draggingRef.current) return

      drawRatio(ratio, duration)
      /*
       * Seek for real now and then, so the picture keeps up with the handle.
       * Every pointermove would drown the browser in seek requests.
       */
      const now = performance.now()
      if (now - lastScrubRef.current > SCRUB_INTERVAL_MS) {
        lastScrubRef.current = now
        onScrub(ratio * duration)
      }
    },
    [duration, ratioAt, drawRatio, onScrub],
  )

  const endDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return
      draggingRef.current = false
      const ratio = ratioAt(e.clientX)
      drawRatio(ratio, duration)
      onSeek(ratio * duration)
      seekingRef.current = false
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* already released */
      }
    },
    [duration, ratioAt, drawRatio, onSeek, seekingRef],
  )

  return (
    <div className="xp-seek-row">
      <div
        ref={refs.root}
        className="xp-seek"
        role="slider"
        tabIndex={0}
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration) || 0}
        aria-valuenow={0}
        onPointerDown={beginDrag}
        onPointerMove={trackPointer}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={() => !draggingRef.current && setHover(null)}
      >
        <div className="xp-seek-track">
          <div ref={refs.buffered} className="xp-seek-buffered" />
          <div ref={refs.played} className="xp-seek-played" />
        </div>
        <div ref={refs.handle} className="xp-seek-handle" />
        {hover && duration > 0 && (
          <div className="xp-seek-tip" style={{ left: `${hover.x * 100}%` }}>
            {formatTime(hover.time)}
          </div>
        )}
      </div>
    </div>
  )
}
