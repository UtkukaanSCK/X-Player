import { useCallback, useEffect, useRef, useState, type Dispatch, type RefObject } from 'react'
import type { PlayerAction } from '../types'

export interface MediaHandlers {
  onReady?: (video: HTMLVideoElement) => void
  onPlay?: () => void
  onPause?: () => void
  onEnded?: () => void
  onError?: (message: string) => void
}

interface Options {
  videoRef: RefObject<HTMLVideoElement | null>
  /** Which video this is. Changing it starts the marks below over. */
  videoId: string
  startTime: number
  startTimeRef: RefObject<number>
  dispatch: Dispatch<PlayerAction>
  paint: () => void
  handlers: MediaHandlers
}

export interface Playback {
  /** Playback reached the end; the big button offers to replay. */
  ended: boolean
  /** Something has played. Before that the poster owns the frame. */
  started: boolean
  /**
   * Play was asked for and no frames have arrived yet. Without it the player
   * shows a big play button while it is in fact busy loading, which reads as
   * "nothing is happening" on a slow connection - the one moment feedback
   * matters most.
   */
  pendingPlay: boolean
  setPendingPlay: (value: boolean) => void
  /** Seeking away from the end means the video is no longer finished. */
  clearEnded: () => void
  /** Stop with a message, and tell the host. */
  fatal: (message: string) => void
}

/**
 * Turns what the <video> element reports into player state.
 *
 * The element is the source of truth for all of it. Nothing here decides that
 * playback started - it waits to be told, so the player and the element cannot
 * disagree about what is happening.
 */
export function useMediaEvents({
  videoRef,
  videoId,
  startTime,
  startTimeRef,
  dispatch,
  paint,
  handlers,
}: Options): Playback {
  const [ended, setEnded] = useState(false)
  const [started, setStarted] = useState(false)
  const [pendingPlay, setPendingPlay] = useState(false)

  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  const fatal = useCallback(
    (message: string) => {
      dispatch({ type: 'error', message })
      handlersRef.current.onError?.(message)
    },
    [dispatch],
  )

  const clearEnded = useCallback(() => setEnded(false), [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    /*
     * Listed rather than written out twice. Eleven pairs of add and remove
     * calls is eleven chances to bind something the teardown does not know
     * about, and a listener left on a <video> keeps the whole player alive.
     */
    const bindings: [string, () => void][] = [
      [
        'loadedmetadata',
        () => {
          dispatch({ type: 'ready', duration: video.duration || 0 })
          handlersRef.current.onReady?.(video)
          paint()
        },
      ],
      ['durationchange', () => dispatch({ type: 'duration', duration: video.duration || 0 })],
      [
        'play',
        () => {
          setEnded(false)
          setStarted(true)
          dispatch({ type: 'playing', playing: true })
          handlersRef.current.onPlay?.()
        },
      ],
      ['playing', () => setPendingPlay(false)],
      [
        'pause',
        () => {
          setPendingPlay(false)
          dispatch({ type: 'playing', playing: false })
          handlersRef.current.onPause?.()
        },
      ],
      [
        'ended',
        () => {
          setEnded(true)
          dispatch({ type: 'playing', playing: false })
          handlersRef.current.onEnded?.()
        },
      ],
      ['volumechange', () => dispatch({ type: 'volume', volume: video.volume, muted: video.muted })],
      ['ratechange', () => dispatch({ type: 'rate', rate: video.playbackRate })],
      ['progress', paint],
      ['seeked', paint],
      [
        'error',
        () => {
          // hls.js reports its own errors separately; this covers progressive sources.
          if (video.error) fatal('This video could not be loaded. Check your connection and try again.')
        },
      ],
      ['enterpictureinpicture', () => dispatch({ type: 'pip', value: true })],
      ['leavepictureinpicture', () => dispatch({ type: 'pip', value: false })],
    ]

    for (const [name, fn] of bindings) video.addEventListener(name, fn)
    return () => {
      for (const [name, fn] of bindings) video.removeEventListener(name, fn)
    }
  }, [videoRef, dispatch, paint, fatal])

  /* A different video has none of this history. */
  useEffect(() => {
    setEnded(false)
    setStarted(false)
    setPendingPlay(false)
    startTimeRef.current = startTime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId])

  return { ended, started, pendingPlay, setPendingPlay, clearEnded, fatal }
}
