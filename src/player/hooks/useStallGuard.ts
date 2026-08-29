import { useEffect, useRef, type Dispatch, type RefObject } from 'react'
import type { PlayerAction } from '../types'

/** No progress for this long counts as buffering. */
const STALL_MS = 1200
/** Still no progress after this long: attempt a silent recovery. */
const RECOVER_MS = 6000
/** Minimum time the spinner stays up, so it cannot flicker. */
const SPINNER_MIN_MS = 400
/** Delay before the spinner appears, so brief hiccups never show one. */
const SPINNER_DELAY_MS = 250

interface Options {
  videoRef: RefObject<HTMLVideoElement | null>
  playingRef: RefObject<boolean>
  dispatch: Dispatch<PlayerAction>
  softRecover: () => void
}

/**
 * Checks a few times a second whether playback is actually advancing.
 * The `waiting` event alone is not enough: some stalls never fire it, and some
 * that do fire it keep playing anyway.
 */
export function useStallGuard({ videoRef, playingRef, dispatch, softRecover }: Options) {
  const lastTimeRef = useRef(0)
  const lastProgressAtRef = useRef(0)
  const stalledSinceRef = useRef(0)
  const spinnerShownAtRef = useRef(0)
  const spinnerOnRef = useRef(false)
  const recoverAttemptsRef = useRef(0)
  const softRecoverRef = useRef(softRecover)
  softRecoverRef.current = softRecover

  useEffect(() => {
    const id = window.setInterval(() => {
      const video = videoRef.current
      const now = performance.now()
      if (!video) return

      // The guard sleeps while paused or ended.
      if (!playingRef.current || video.paused || video.ended) {
        lastProgressAtRef.current = now
        stalledSinceRef.current = 0
        recoverAttemptsRef.current = 0
        if (spinnerOnRef.current) {
          spinnerOnRef.current = false
          dispatch({ type: 'waiting', waiting: false })
        }
        return
      }

      const t = video.currentTime
      if (t !== lastTimeRef.current) {
        lastTimeRef.current = t
        lastProgressAtRef.current = now
      }

      const stuckFor = now - lastProgressAtRef.current
      const shouldWait = stuckFor > STALL_MS

      if (shouldWait) {
        if (stalledSinceRef.current === 0) stalledSinceRef.current = now
        if (!spinnerOnRef.current && now - stalledSinceRef.current > SPINNER_DELAY_MS) {
          spinnerOnRef.current = true
          spinnerShownAtRef.current = now
          dispatch({ type: 'waiting', waiting: true })
        }
        // Stuck for a long time: try to recover without showing the viewer anything.
        if (stuckFor > RECOVER_MS && recoverAttemptsRef.current < 3) {
          recoverAttemptsRef.current += 1
          lastProgressAtRef.current = now
          softRecoverRef.current()
        }
      } else {
        stalledSinceRef.current = 0
        recoverAttemptsRef.current = 0
        if (spinnerOnRef.current && now - spinnerShownAtRef.current > SPINNER_MIN_MS) {
          spinnerOnRef.current = false
          dispatch({ type: 'waiting', waiting: false })
        }
      }
    }, 250)

    return () => window.clearInterval(id)
  }, [videoRef, playingRef, dispatch])
}
