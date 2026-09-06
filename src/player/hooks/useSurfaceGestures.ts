import { useCallback, useRef } from 'react'

/** Two taps this close together, in time and in space, are one gesture. */
const DOUBLE_TAP_MS = 320
const DOUBLE_TAP_PX = 60
/** A press that travels further than this was a drag, not a click. */
const SLOP_PX = 8
/** A press held longer than this was not a click either. */
const HOLD_MS = 600

interface Options {
  /** False while an error or the resume offer owns the surface. */
  enabled: boolean
  togglePlay: () => void
  seekBy: (delta: number) => void
  toggleFullscreen: () => void
  onActivity: () => void
}

/**
 * What tapping and clicking the picture does.
 *
 * A bare pointerup is not a click: a drag that happens to end over the video,
 * or a press that began somewhere else entirely, would both toggle playback.
 * The press and the release have to belong to each other, which is what stops
 * the video pausing itself when someone drags across it.
 */
export function useSurfaceGestures({ enabled, togglePlay, seekBy, toggleFullscreen, onActivity }: Options) {
  const press = useRef<{ id: number; x: number; y: number; at: number } | null>(null)
  const lastTap = useRef({ at: 0, x: 0 })

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    press.current = { id: e.pointerId, x: e.clientX, y: e.clientY, at: performance.now() }
  }, [])

  const onPointerCancel = useCallback(() => {
    press.current = null
  }, [])

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const began = press.current
      press.current = null
      if (!enabled || !began) return
      if (
        began.id !== e.pointerId ||
        Math.hypot(e.clientX - began.x, e.clientY - began.y) > SLOP_PX ||
        performance.now() - began.at > HOLD_MS
      ) {
        return
      }

      if (e.pointerType !== 'touch') {
        // A mouse click toggles play; a double click also toggles full screen.
        togglePlay()
        return
      }

      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const now = performance.now()
      const isDouble = now - lastTap.current.at < DOUBLE_TAP_MS && Math.abs(x - lastTap.current.x) < DOUBLE_TAP_PX
      lastTap.current = { at: now, x }

      if (!isDouble) {
        onActivity()
        return
      }
      /* Double tap: back on the left third, forward on the right, play in the middle. */
      const third = rect.width / 3
      if (x < third) seekBy(-10)
      else if (x > rect.width - third) seekBy(10)
      else togglePlay()
    },
    [enabled, togglePlay, seekBy, onActivity],
  )

  const onDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.nativeEvent instanceof MouseEvent) toggleFullscreen()
    },
    [toggleFullscreen],
  )

  return { onPointerDown, onPointerUp, onPointerCancel, onDoubleClick }
}
