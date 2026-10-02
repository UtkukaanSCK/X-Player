import { useCallback, useEffect, useRef, type RefObject } from 'react'
// The tooltip is read, so it stays a clock face; the ARIA value is heard, so
// it becomes words - and that one lives in the painter, with the other sinks.
import { formatTime, spokenTime } from '../format'
import type { SeekRefs } from '../hooks/useProgressPaint'
import type { FramePreview } from '../hooks/useFramePreview'
import { clampRange } from '../range'
import type { XPlayerRange } from '../types'

export type { SeekRefs }

/** Seek for real no more often than this while a drag is in progress. */
const SCRUB_INTERVAL_MS = 120

/** Seconds an arrow key moves a selection handle, and with Shift held. */
const RANGE_STEP = 1
const RANGE_STEP_SHIFT = 5

interface Props {
  refs: SeekRefs
  duration: number
  /** While dragging, the rAF loop stops reading the video's position. */
  seekingRef: RefObject<boolean>
  /** Draws a dragged-to position. The same painter the play loop uses. */
  drawRatio: (ratio: number, duration: number) => void
  /** The frame under the pointer. */
  preview: FramePreview
  /** A stretch of the video to mark, with a handle at each end. */
  range?: XPlayerRange | null
  onRangeChange?: (range: XPlayerRange) => void
  onSeek: (seconds: number) => void
  onScrub: (seconds: number) => void
  onActivity: () => void
}

type Edge = 'start' | 'end'

/**
 * The progress bar.
 *
 * Nothing the pointer does here goes through React. The bar, the handle and the
 * tooltip are written straight to the DOM, so a drag costs no renders at all -
 * it used to cost one per pointermove, which is one per frame on any ordinary
 * mouse, spent entirely on moving a tooltip forty pixels.
 *
 * A selection, when the host gives one, follows the same rule: its two handles
 * move under the pointer without a render, and the host hears about it once,
 * when the handle is let go.
 */
export function SeekBar({
  refs,
  duration,
  seekingRef,
  drawRatio,
  preview,
  range = null,
  onRangeChange,
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

  const startRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const bandRef = useRef<HTMLDivElement>(null)
  /** Where the handles are right now, which during a drag is ahead of the host. */
  const liveRange = useRef<XPlayerRange | null>(range)
  const draggingEdge = useRef<Edge | null>(null)

  useEffect(() => {
    if (!draggingEdge.current) liveRange.current = range
  }, [range])

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
      // A ratio, not a position: the stylesheet centres and clamps it.
      el.style.setProperty('--xp-tip-x', String(ratio))
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

  /**
   * Moves the two handles and the band between them.
   *
   * The spoken value is rewritten only when the whole second changes, for the
   * reason the playhead does the same: an assistive technology told sixty times
   * a second that a slider moved reads it out sixty times.
   */
  const paintRange = useCallback(
    (next: XPlayerRange) => {
      if (duration <= 0) return
      const place = (el: HTMLDivElement | null, seconds: number) => {
        if (!el) return
        el.style.left = `${(seconds / duration) * 100}%`
        const said = String(Math.round(seconds))
        if (el.getAttribute('aria-valuenow') !== said) {
          el.setAttribute('aria-valuenow', said)
          el.setAttribute('aria-valuetext', spokenTime(Number(said)))
        }
      }
      place(startRef.current, next.start)
      place(endRef.current, next.end)
      const band = bandRef.current
      if (band) {
        band.style.left = `${(next.start / duration) * 100}%`
        band.style.width = `${((next.end - next.start) / duration) * 100}%`
      }
    },
    [duration],
  )

  const moveHandle = useCallback(
    (edge: Edge, seconds: number, tell: boolean) => {
      const current = liveRange.current
      if (!current || duration <= 0) return
      const next = clampRange({ ...current, [edge]: seconds }, duration, edge)
      liveRange.current = next
      paintRange(next)
      if (tell) onRangeChange?.(next)
      onActivity()
    },
    [duration, paintRange, onRangeChange, onActivity],
  )

  const grabHandle = (edge: Edge) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (!duration || !liveRange.current) return
    // Neither a seek nor a scrub: the bar underneath must not hear this at all.
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    draggingEdge.current = edge
    onActivity()
  }

  const dragHandle = (edge: Edge) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingEdge.current !== edge) return
    e.stopPropagation()
    moveHandle(edge, ratioAt(e.clientX) * duration, false)
  }

  const dropHandle = (edge: Edge) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingEdge.current !== edge) return
    draggingEdge.current = null
    e.stopPropagation()
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
    if (liveRange.current) onRangeChange?.(liveRange.current)
  }

  const handleKeys = (edge: Edge) => (e: React.KeyboardEvent<HTMLDivElement>) => {
    const current = liveRange.current
    if (!current || duration <= 0 || e.altKey || e.ctrlKey || e.metaKey) return
    const step = e.shiftKey ? RANGE_STEP_SHIFT : RANGE_STEP
    let seconds: number
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        seconds = current[edge] - step
        break
      case 'ArrowRight':
      case 'ArrowUp':
        seconds = current[edge] + step
        break
      case 'Home':
        seconds = 0
        break
      case 'End':
        seconds = duration
        break
      default:
        return
    }
    // The window sends these keys to the player, which would seek or change the
    // volume behind a handle the viewer is moving.
    e.preventDefault()
    e.stopPropagation()
    moveHandle(edge, seconds, true)
  }

  const percent = (seconds: number) => `${duration > 0 ? (seconds / duration) * 100 : 0}%`

  const handle = (edge: Edge, ref: RefObject<HTMLDivElement | null>, seconds: number) => (
    <div
      ref={ref}
      className="xp-range-handle"
      data-xp-range={edge}
      role="slider"
      tabIndex={0}
      aria-label={edge === 'start' ? 'Selection start' : 'Selection end'}
      aria-valuemin={0}
      aria-valuemax={Math.round(duration) || 0}
      aria-valuenow={Math.round(seconds)}
      aria-valuetext={spokenTime(Math.round(seconds))}
      style={{ left: percent(seconds) }}
      onPointerDown={grabHandle(edge)}
      onPointerMove={dragHandle(edge)}
      onPointerUp={dropHandle(edge)}
      onPointerCancel={dropHandle(edge)}
      onKeyDown={handleKeys(edge)}
    />
  )

  return (
    <div className="xp-seek-row">
      <div className="xp-seek-area">
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
            {range && (
              <div
                ref={bandRef}
                className="xp-seek-range"
                style={{ left: percent(range.start), width: percent(range.end - range.start) }}
              />
            )}
          </div>
          <div ref={refs.handle} className="xp-seek-handle" />
          <div ref={tipRef} className="xp-seek-tip" hidden>
            {preview.enabled && <canvas ref={preview.canvasRef} className="xp-seek-frame" hidden />}
            <span ref={tipTimeRef} className="xp-seek-tip-time" />
          </div>
        </div>
        {/*
          * Outside the seek slider, not inside it: a slider may not contain
          * another one, and a press that reached the bar would seek the video
          * the moment a handle was grabbed.
          */}
        {range && (
          <>
            {handle('start', startRef, range.start)}
            {handle('end', endRef, range.end)}
          </>
        )}
      </div>
    </div>
  )
}
