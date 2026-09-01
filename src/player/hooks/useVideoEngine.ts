import { useCallback, useEffect, useRef, type Dispatch, type RefObject } from 'react'
import type HlsJs from 'hls.js'
import type { ErrorData, Level } from 'hls.js'
import { loadHls } from '../load-hls'
import type { PlayerAction, QualityLevel, SourceKind } from '../types'

function isHlsSource(src: string, type: SourceKind) {
  if (type === 'hls') return true
  if (type === 'native') return false
  return /\.m3u8(\?|#|$)/i.test(src)
}

function levelLabel(level: Level): string {
  if (level.height) return `${level.height}p`
  if (level.bitrate) return `${Math.round(level.bitrate / 1000)} kbps`
  return 'Unknown'
}

/** Without MediaSource (iOS Safari) hls.js cannot run; fall back to native HLS. */
function hasMediaSource() {
  return typeof window !== 'undefined' && ('MediaSource' in window || 'ManagedMediaSource' in window)
}

/** Exponential backoff for network errors (ms). */
const BACKOFF = [500, 1500, 4000]
const MAX_RETRIES = BACKOFF.length

export interface VideoEngine {
  /** User pressed "Try again": rebuild the source from scratch, keeping position. */
  reload: () => void
  /** Silent recovery, called by the stall guard. Does not tear the source down. */
  softRecover: () => void
  /** HLS quality selection. -1 = automatic. */
  setLevel: (level: number) => void
}

interface Options {
  videoRef: RefObject<HTMLVideoElement | null>
  src: string
  type: SourceKind
  startTimeRef: RefObject<number>
  dispatch: Dispatch<PlayerAction>
  onFatal: (message: string) => void
}

/**
 * Attaches the source to the <video> element: hls.js for HLS (native on Safari),
 * a plain src otherwise. Recovers from network and media errors on its own.
 *
 * hls.js is loaded lazily, so a page that only plays an MP4 never downloads it.
 */
export function useVideoEngine({ videoRef, src, type, startTimeRef, dispatch, onFatal }: Options): VideoEngine {
  const hlsRef = useRef<HlsJs | null>(null)
  const retriesRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  /** Guards against a late loader result when the source changed in the meantime. */
  const tokenRef = useRef(0)
  const onFatalRef = useRef(onFatal)
  onFatalRef.current = onFatal

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const attach = useCallback(() => {
    const video = videoRef.current
    if (!video || !src) return

    clearTimer()
    dispatch({ type: 'loading' })
    const token = ++tokenRef.current

    const resumeAt = startTimeRef.current
    const seekWhenReady = () => {
      const v = videoRef.current
      if (!v || resumeAt <= 0.5) return
      try {
        v.currentTime = resumeAt
      } catch {
        /* no metadata yet - the loadedmetadata listener covers it */
      }
    }

    const playNatively = () => {
      video.src = src
      video.addEventListener('loadedmetadata', seekWhenReady, { once: true })
    }

    if (!isHlsSource(src, type)) {
      playNatively()
      return
    }

    const nativeHls = video.canPlayType('application/vnd.apple.mpegurl') !== ''

    // No MediaSource (iOS): do not download hls.js at all.
    if (!hasMediaSource()) {
      if (nativeHls) playNatively()
      else onFatalRef.current('Your browser does not support this stream format.')
      return
    }

    void loadHls()
      .then((Hls) => {
        if (token !== tokenRef.current) return
        const v = videoRef.current
        if (!v) return

        if (!Hls.isSupported()) {
          if (nativeHls) playNatively()
          else onFatalRef.current('Your browser does not support this stream format.')
          return
        }

        const hls = new Hls({
          // For VOD we want a solid buffer, not minimal latency.
          lowLatencyMode: false,
          enableWorker: true,
          // 30 s of forward buffer removes most stalls; the 60 s ceiling keeps
          // memory in check on mobile.
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          maxBufferSize: 60 * 1000 * 1000,
          // Do not hold more than 30 s behind the playhead, or long videos leak memory.
          backBufferLength: 30,
          // Assume a realistic starting bandwidth: an over-optimistic first guess
          // makes playback stall immediately on startup.
          abrEwmaDefaultEstimate: 800_000,
          startLevel: -1,
          fragLoadingMaxRetry: 4,
          manifestLoadingMaxRetry: 3,
          levelLoadingMaxRetry: 4,
        })
        hlsRef.current = hls

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          retriesRef.current = 0
          const levels: QualityLevel[] = hls.levels.map((lv, i) => ({
            id: i,
            height: lv.height ?? 0,
            bitrate: lv.bitrate ?? 0,
            label: levelLabel(lv),
          }))
          // Collapse duplicate resolutions to the highest bitrate so the menu stays short.
          const seen = new Map<string, QualityLevel>()
          for (const lv of levels) {
            const prev = seen.get(lv.label)
            if (!prev || lv.bitrate > prev.bitrate) seen.set(lv.label, lv)
          }
          dispatch({
            type: 'levels',
            levels: [...seen.values()].sort((a, b) => b.height - a.height || b.bitrate - a.bitrate),
          })
          seekWhenReady()
        })

        hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
          dispatch({ type: 'activeLevel', level: data.level })
        })

        hls.on(Hls.Events.ERROR, (_e, data: ErrorData) => {
          if (!data.fatal) return
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            // Media errors usually come from one bad segment; no need to tear down.
            hls.recoverMediaError()
            return
          }
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR && retriesRef.current < MAX_RETRIES) {
            const wait = BACKOFF[retriesRef.current]
            retriesRef.current += 1
            clearTimer()
            timerRef.current = window.setTimeout(() => hls.startLoad(), wait)
            return
          }
          onFatalRef.current(
            data.type === Hls.ErrorTypes.NETWORK_ERROR
              ? 'Connection lost. Check your internet and try again.'
              : 'This video could not be played.',
          )
        })

        hls.attachMedia(v)
        hls.loadSource(src)
      })
      .catch(() => {
        if (token !== tokenRef.current) return
        onFatalRef.current('Playback components could not be loaded. Reload the page and try again.')
      })
  }, [src, type, videoRef, startTimeRef, dispatch])

  const teardown = useCallback(() => {
    clearTimer()
    tokenRef.current += 1
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }
    const video = videoRef.current
    if (video) {
      video.removeAttribute('src')
      video.load()
    }
  }, [videoRef])

  useEffect(() => {
    dispatch({ type: 'reset' })
    retriesRef.current = 0
    attach()
    return teardown
  }, [attach, teardown, dispatch])

  const reload = useCallback(() => {
    const video = videoRef.current
    // Keep the viewer's position across the rebuild.
    if (video && video.currentTime > 0.5) startTimeRef.current = video.currentTime
    retriesRef.current = 0
    teardown()
    attach()
  }, [attach, teardown, videoRef, startTimeRef])

  const softRecover = useCallback(() => {
    const hls = hlsRef.current
    const video = videoRef.current
    if (hls) {
      // Cheapest first: nudge the loader, then try media-error recovery.
      hls.startLoad()
      hls.recoverMediaError()
      return
    }
    if (video) {
      /*
       * On a progressive source a tiny forward jump usually unsticks a decoder
       * that has data but has stopped using it.
       *
       * Only when it has data, though. Seeking clears the picture until the new
       * position decodes, so nudging a video that is simply starved trades a
       * held frame for a black rectangle and gets nothing back - the bytes it
       * needs are not there to find. On a bad connection that made this player
       * look worse than a bare video element, which sat on its last frame and at
       * least showed something.
       */
      const t = video.currentTime
      const ranges = video.buffered
      let bufferedAhead = 0
      for (let i = 0; i < ranges.length; i++) {
        if (ranges.start(i) <= t + 0.25 && ranges.end(i) > t) bufferedAhead = ranges.end(i) - t
      }

      if (bufferedAhead > 0.3) {
        try {
          video.currentTime = Math.min(t + 0.1, Math.max(t, video.duration || t))
        } catch {
          /* ignore */
        }
      }
      void video.play().catch(() => {})
    }
  }, [videoRef])

  const setLevel = useCallback(
    (level: number) => {
      const hls = hlsRef.current
      if (hls) hls.currentLevel = level
      dispatch({ type: 'selectedLevel', level })
    },
    [dispatch],
  )

  return { reload, softRecover, setLevel }
}
