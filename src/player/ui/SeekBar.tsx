import { useCallback, useRef, useState, type RefObject } from 'react'
import { formatTime } from '../format'

export interface SeekRefs {
  root: RefObject<HTMLDivElement | null>
  played: RefObject<HTMLDivElement | null>
  buffered: RefObject<HTMLDivElement | null>
  handle: RefObject<HTMLDivElement | null>
}

interface Props {
  refs: SeekRefs
  duration: number
  /** While dragging, the rAF loop stops writing to the DOM. */
  seekingRef: RefObject<boolean>
  onSeek: (seconds: number) => void
  onScrub: (seconds: number) => void
  onActivity: () => void
}

/**
 * The progress bar. Dragging never touches React state: the bar and the handle
 * are written straight to the DOM, so no frames are dropped.
 */
export function SeekBar({ refs, duration, seekingRef, onSeek, onScrub, onActivity }: Props) {
  const [hover, setHover] = useState<{ x: number; time: number } | null>(null)
  const draggingRef = useRef(false)
  const lastScrubRef = useRef(0)

  const ratioFromEvent = useCallback(
    (clientX: number) => {
      const el = refs.root.current
      if (!el) return 0
      const rect = el.getBoundingClientRect()
      if (rect.width === 0) return 0
      return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    },
    [refs.root],
  )

  const paint = useCallback(
    (ratio: number) => {
      if (refs.played.current) refs.played.current.style.transform = `scaleX(${ratio})`
      if (refs.handle.current) refs.handle.current.style.left = `${ratio * 100}%`
      if (refs.root.current) {
        refs.root.current.setAttribute('aria-valuenow', String(Math.round(ratio * duration)))
        refs.root.current.setAttribute('aria-valuetext', formatTime(ratio * duration))
      }
    },
    [refs, duration],
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!duration) return
      e.preventDefault()
      const el = e.currentTarget
      el.setPointerCapture(e.pointerId)
      draggingRef.current = true
      seekingRef.current = true
      const ratio = ratioFromEvent(e.clientX)
      paint(ratio)
      onScrub(ratio * duration)
      lastScrubRef.current = performance.now()
      onActivity()
    },
    [duration, ratioFromEvent, paint, onScrub, seekingRef, onActivity],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!duration) return
      const ratio = ratioFromEvent(e.clientX)

      if (draggingRef.current) {
        paint(ratio)
        setHover({ x: ratio, time: ratio * duration })
        // Seek for real now and then so the frame updates live, but not on every
        // pointermove, or the browser drowns in seek requests.
        const now = performance.now()
        if (now - lastScrubRef.current > 120) {
          lastScrubRef.current = now
          onScrub(ratio * duration)
        }
        return
      }
      setHover({ x: ratio, time: ratio * duration })
    },
    [duration, ratioFromEvent, paint, onScrub],
  )

  const finish = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return
      draggingRef.current = false
      const ratio = ratioFromEvent(e.clientX)
      paint(ratio)
      onSeek(ratio * duration)
      seekingRef.current = false
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* already released */
      }
    },
    [duration, ratioFromEvent, paint, onSeek, seekingRef],
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
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
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
