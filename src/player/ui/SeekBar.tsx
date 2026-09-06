import { useCallback, useRef, type RefObject } from 'react'
// The tooltip is read, so it stays a clock face; the ARIA value is heard, so
// it becomes words - and that one lives in the painter, with the other sinks.
import { formatTime } from '../format'
import type { SeekRefs } from '../hooks/useProgressPaint'
import type { FramePreview } from '../hooks/useFramePreview'

export type { SeekRefs }

/** Seek for real no more often than this while a drag is in progress. */
const SCRUB_INTERVAL_MS = 120

interface Props {
  refs: SeekRefs
  duration: number
  /** While dragging, the rAF loop stops reading the video's position. */
  seekingRef: RefObject<boolean>
  /** Draws a dragged-to position. The same painter the play loop uses. */
  drawRatio: (ratio: number, duration: number) => void
  /** The frame under the pointer. */
  preview: FramePreview
  onSeek: (seconds: number) => void
  onScrub: (seconds: number) => void
  onActivity: () => void
}

/**
 * The progress bar.
 *
 * Nothing the pointer does here goes through React. The bar, the handle and the
 * tooltip are written straight to the DOM, so a drag costs no renders at all -
 * it used to cost one per pointermove, which is one per frame on any ordinary
 * mouse, spent entirely on moving a tooltip forty pixels.
 */
export function SeekBar({
  refs,
  duration,
  seekingRef,
  drawRatio,
  preview,
  onSeek,
  onScrub,
  onActivity,
}: Props) {
  const tipRef = useRef<HTMLDivElement>(null)
  const tipTimeRef = useRef<HTMLSpanElement>(null)
  /** What the tooltip is currently showing, so it is not told twice. */
  const tip = useRef({ shown: false, second: -1 })
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

  /** Pass null to take the tooltip away. */
  const drawTip = useCallback(
    (ratio: number | null) => {
      const el = tipRef.current
      if (!el) return
      if (ratio === null || duration <= 0) {
        if (tip.current.shown) {
          tip.current.shown = false
          tip.current.second = -1
          el.hidden = true
          preview.release()
        }
        return
      }
      if (!tip.current.shown) {
        tip.current.shown = true
        el.hidden = false
      }
      el.style.left = `${ratio * 100}%`
      const seconds = ratio * duration
      const second = Math.floor(seconds)
      if (second !== tip.current.second) {
        tip.current.second = second
        const time = tipTimeRef.current
        if (time) time.textContent = formatTime(second)
        // Asked for by the second, so sweeping within one costs nothing.
        preview.request(seconds)
      }
    },
    [duration, preview],
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
      drawTip(ratio)
      onScrub(ratio * duration)
      lastScrubRef.current = performance.now()
      onActivity()
    },
    [duration, ratioAt, drawRatio, drawTip, onScrub, seekingRef, onActivity],
  )

  const trackPointer = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!duration) return
      const ratio = ratioAt(e.clientX)
      drawTip(ratio)
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
    [duration, ratioAt, drawRatio, drawTip, onScrub],
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
        onPointerLeave={() => {
          if (!draggingRef.current) drawTip(null)
        }}
      >
        <div className="xp-seek-track">
          <div ref={refs.buffered} className="xp-seek-buffered" />
          <div ref={refs.played} className="xp-seek-played" />
        </div>
        <div ref={refs.handle} className="xp-seek-handle" />
        <div ref={tipRef} className="xp-seek-tip" hidden>
          {preview.enabled && <canvas ref={preview.canvasRef} className="xp-seek-frame" hidden />}
          <span ref={tipTimeRef} className="xp-seek-tip-time" />
        </div>
      </div>
    </div>
  )
}
