import { useEffect, useRef, type Dispatch, type RefObject } from 'react'
import type { PlayerAction } from '../types'

/** How often the guard looks at the clock. */
const CHECK_MS = 250
/** No progress for this long counts as buffering. */
const STALL_MS = 1200
/** Still no progress after this long: attempt a silent recovery. */
const RECOVER_MS = 6000
/** Minimum time the spinner stays up, so it cannot flicker. */
const SPINNER_MIN_MS = 400
/** Delay before the spinner appears, so brief hiccups never show one. */
const SPINNER_DELAY_MS = 250
/** Attempts to spend on one stall before letting it be. */
const MAX_RECOVERIES = 3

interface Options {
  videoRef: RefObject<HTMLVideoElement | null>
  /** Playback has been asked for. The guard only watches while it has. */
  playing: boolean
  dispatch: Dispatch<PlayerAction>
  softRecover: () => void
}

/**
 * Checks a few times a second whether playback is actually advancing.
 *
 * The `waiting` event alone is not enough: some stalls never fire it, and some
 * that do fire it keep playing anyway. So the guard watches the clock instead
 * of listening for a promise about it.
 */
export function useStallGuard({ videoRef, playing, dispatch, softRecover }: Options) {
  const softRecoverRef = useRef(softRecover)
  softRecoverRef.current = softRecover

  /** Everything the guard remembers about the stretch of playback it is watching. */
  const watch = useRef({ at: 0, progressAt: 0, stalledSince: 0, spinnerAt: 0, spinner: false, recoveries: 0 })

  useEffect(() => {
    /*
     * Start of a stretch of playback, or the end of one. Either way the guard
     * knows nothing yet, and the clock starts from here - without that, a
     * player paused for a minute would look stalled for a minute the instant
     * it resumed, and would show a spinner and try to recover from it.
     */
    const forget = () => {
      const w = watch.current
      w.progressAt = performance.now()
      w.stalledSince = 0
      w.recoveries = 0
      if (w.spinner) {
        w.spinner = false
        dispatch({ type: 'waiting', waiting: false })
      }
    }
    forget()

    /*
     * Nothing to watch while playback is not running. The guard used to look
     * anyway, four times a second for as long as the player was on the page,
     * so a video nobody had pressed play on still woke the machine up to
     * decide there was nothing to do.
     */
    if (!playing) return

    const id = window.setInterval(() => {
      const video = videoRef.current
      if (!video) return
      const now = performance.now()
      const w = watch.current

      /* The element disagrees with the state: nothing is playing after all. */
      if (video.paused || video.ended) {
        forget()
        return
      }

      if (video.currentTime !== w.at) {
        w.at = video.currentTime
        w.progressAt = now
      }

      const stuckFor = now - w.progressAt

      if (stuckFor <= STALL_MS) {
        w.stalledSince = 0
        w.recoveries = 0
        if (w.spinner && now - w.spinnerAt > SPINNER_MIN_MS) {
          w.spinner = false
          dispatch({ type: 'waiting', waiting: false })
        }
        return
      }

      if (w.stalledSince === 0) w.stalledSince = now
      if (!w.spinner && now - w.stalledSince > SPINNER_DELAY_MS) {
        w.spinner = true
        w.spinnerAt = now
        dispatch({ type: 'waiting', waiting: true })
      }
      /* Stuck for a long time: try to recover without showing the viewer anything. */
      if (stuckFor > RECOVER_MS && w.recoveries < MAX_RECOVERIES) {
        w.recoveries += 1
        w.progressAt = now
        softRecoverRef.current()
      }
    }, CHECK_MS)

    return () => {
      window.clearInterval(id)
      forget()
    }
  }, [videoRef, playing, dispatch])
}
