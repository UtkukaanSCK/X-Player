import { useCallback, useEffect, useMemo, useRef, type Dispatch, type RefObject } from 'react'
import type { PlayerAction, XPlayerTrack } from '../types'

/**
 * A subtitle file on another origin can only be read with crossOrigin set. But
 * that attribute also forces the video itself to be fetched with CORS, so a
 * video served without CORS headers stops loading entirely. Turn it on only
 * when a track actually needs it.
 */
function needsCrossOrigin(tracks: XPlayerTrack[]): boolean {
  if (tracks.length === 0 || typeof window === 'undefined') return false
  return tracks.some((t) => {
    try {
      return new URL(t.src, window.location.href).origin !== window.location.origin
    } catch {
      return false
    }
  })
}

interface Options {
  videoRef: RefObject<HTMLVideoElement | null>
  tracks: XPlayerTrack[]
  /** Which video this is, regardless of which rendition is playing. */
  videoId: string
  activeTextTrack: number
  textTracks: { id: number; label: string }[]
  dispatch: Dispatch<PlayerAction>
  showToast: (text: string) => void
}

export interface Subtitles {
  /** For the <video> element; undefined unless a track needs it. */
  crossOrigin: 'anonymous' | undefined
  setTextTrack: (index: number) => void
  /** The `c` key: first track on, or subtitles off. */
  cycleSubtitles: () => void
}

/** Keeps the element's text tracks and the player's idea of them in step. */
export function useSubtitles({
  videoRef,
  tracks,
  videoId,
  activeTextTrack,
  textTracks,
  dispatch,
  showToast,
}: Options): Subtitles {
  /*
   * `tracks` is usually an inline array at the call site, so its identity
   * changes on every render. Reduce it to a value, and the effects below watch
   * what the tracks say rather than which array said it.
   */
  const key = useMemo(
    () => tracks.map((t) => `${t.src}|${t.label}|${t.srclang}|${t.default ? 1 : 0}`).join('\n'),
    [tracks],
  )
  const tracksRef = useRef(tracks)
  tracksRef.current = tracks

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const crossOrigin = useMemo(() => (needsCrossOrigin(tracksRef.current) ? 'anonymous' : undefined), [key])

  /* Read the element's tracks into state whenever the source or the list changes. */
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    dispatch({
      type: 'textTracks',
      tracks: Array.from(video.textTracks).map((t, i) => ({
        id: i,
        label: t.label || t.language || `Subtitles ${i + 1}`,
      })),
    })
    dispatch({ type: 'activeTextTrack', index: tracksRef.current.findIndex((t) => t.default) })
  }, [videoRef, key, videoId, dispatch])

  /* Show the chosen one and none of the others. */
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    Array.from(video.textTracks).forEach((t, i) => {
      t.mode = i === activeTextTrack ? 'showing' : 'disabled'
    })
  }, [videoRef, activeTextTrack, textTracks])

  const setTextTrack = useCallback(
    (index: number) => {
      dispatch({ type: 'activeTextTrack', index })
      showToast(index === -1 ? 'Subtitles off' : (textTracks[index]?.label ?? 'Subtitles on'))
    },
    [dispatch, textTracks, showToast],
  )

  const cycleSubtitles = useCallback(() => {
    if (textTracks.length === 0) return
    // A toggle: the first track when there is none showing, off when there is.
    setTextTrack(activeTextTrack === -1 ? 0 : -1)
  }, [activeTextTrack, textTracks.length, setTextTrack])

  return { crossOrigin, setTextTrack, cycleSubtitles }
}
