'use client'

import { useEffect, useState } from 'react'

export interface Reading {
  state: 'idle' | 'playing' | 'stalled' | 'paused' | 'ended' | 'error'
  time: number
  /** Seconds of video buffered ahead of the playhead. */
  ahead: number
  error: string | null
}

const EMPTY: Reading = { state: 'idle', time: 0, ahead: 0, error: null }

const ERROR_NAMES: Record<number, string> = {
  1: 'ABORTED',
  2: 'NETWORK',
  3: 'DECODE',
  4: 'SRC_NOT_SUPPORTED',
}

/**
 * Polls a video element for the numbers a viewer would otherwise have to guess.
 *
 * Polling rather than listening on purpose. The `waiting` event fires when
 * nothing is wrong and stays silent when everything is, so a page that trusted
 * it would show a comparison that did not match what people could see with
 * their own eyes. What is printed here is read straight off the element.
 */
export function useReading(getVideo: () => HTMLVideoElement | null): Reading {
  const [reading, setReading] = useState<Reading>(EMPTY)

  useEffect(() => {
    const id = window.setInterval(() => {
      const video = getVideo()
      if (!video) {
        setReading(EMPTY)
        return
      }

      const ranges = video.buffered
      const ahead = ranges.length > 0 ? ranges.end(ranges.length - 1) - video.currentTime : 0

      let state: Reading['state'] = 'paused'
      if (video.error) state = 'error'
      else if (video.ended) state = 'ended'
      // readyState below HAVE_FUTURE_DATA while trying to play is a stall, by
      // definition: there is no next frame to show.
      else if (!video.paused && video.readyState < 3) state = 'stalled'
      else if (!video.paused) state = 'playing'

      setReading({
        state,
        time: video.currentTime,
        ahead: Math.max(0, ahead),
        error: video.error ? (ERROR_NAMES[video.error.code] ?? `code ${video.error.code}`) : null,
      })
    }, 300)

    return () => window.clearInterval(id)
  }, [getVideo])

  return reading
}
