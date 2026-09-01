import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { XPlayerApi, XPlayerAudioTrack, XPlayerProps, XPlayerSource, XPlayerTrack } from './types'
import { usePlayerState } from './hooks/usePlayerState'
import { useVideoEngine } from './hooks/useVideoEngine'
import { useStallGuard } from './hooks/useStallGuard'
import { useControlsVisibility } from './hooks/useControlsVisibility'
import { useKeyboard, type PlayerCommands } from './hooks/useKeyboard'
import { useResume } from './hooks/useResume'
import { ControlBar } from './ui/ControlBar'
import { CenterOverlay } from './ui/CenterOverlay'
import { Toast, useToast } from './ui/Toast'
import type { SeekRefs } from './ui/SeekBar'
import { formatTime, spokenTime } from './format'
import './styles/player.css'

const RATE_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

/** Stable defaults, so a fresh array is not created on every render. */
const NO_TRACKS: XPlayerTrack[] = []
const NO_SOURCES: XPlayerSource[] = []
const NO_AUDIO: XPlayerAudioTrack[] = []

/**
 * A subtitle file on another origin can only be read with crossOrigin set.
 * But that attribute also forces the video itself to be fetched with CORS, so a
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

export function XPlayer({
  src,
  sources = NO_SOURCES,
  type = 'auto',
  poster,
  title,
  autoPlay = false,
  muted = false,
  loop = false,
  startTime = 0,
  accent,
  tracks = NO_TRACKS,
  audioTracks = NO_AUDIO,
  activeAudioTrack = -1,
  onAudioTrack,
  apiRef,
  rememberPosition = true,
  storageKey,
  className,
  style,
  onReady,
  onPlay,
  onPause,
  onEnded,
  onError,
}: XPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const seekRefs: SeekRefs = {
    root: useRef<HTMLDivElement>(null),
    played: useRef<HTMLDivElement>(null),
    buffered: useRef<HTMLDivElement>(null),
    handle: useRef<HTMLDivElement>(null),
  }
  const timeLabelRef = useRef<HTMLSpanElement>(null)
  const seekingRef = useRef(false)
  const startTimeRef = useRef(startTime)

  const [state, dispatch] = usePlayerState()
  const [ended, setEnded] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [started, setStarted] = useState(false)
  /**
   * Play was requested but no frames have arrived yet. Without this the player
   * shows a big play button while it is in fact busy loading, which reads as
   * "nothing is happening" on a slow connection - the one moment feedback
   * matters most.
   */
  const [pendingPlay, setPendingPlay] = useState(false)
  /** Was playback running when the viewer switched quality? */
  const resumeAfterSwitchRef = useRef(false)
  const { toast, show: showToast } = useToast()

  const playingRef = useRef(false)
  playingRef.current = state.playing

  const handlersRef = useRef({ onReady, onPlay, onPause, onEnded, onError })
  handlersRef.current = { onReady, onPlay, onPause, onEnded, onError }

  const onFatal = useCallback(
    (message: string) => {
      dispatch({ type: 'error', message })
      handlersRef.current.onError?.(message)
    },
    [dispatch],
  )

  // An explicit src wins; otherwise play whichever rendition is selected.
  const chosen = sources[state.activeSource] ?? sources[0]
  const activeSrc = src ?? chosen?.src ?? ''
  const activeType = src ? type : (chosen?.type ?? type)

  const engine = useVideoEngine({
    videoRef,
    src: activeSrc,
    type: activeType,
    startTimeRef,
    dispatch,
    onFatal,
  })
  useStallGuard({ videoRef, playingRef, dispatch, softRecover: engine.softRecover })

  // Which video this is, independent of which rendition is playing. Switching
  // quality must not look like a different video to anything downstream.
  const videoId = storageKey ?? src ?? sources[0]?.src ?? ''

  const resume = useResume(videoRef, videoId, rememberPosition, storageKey)

  const locked = menuOpen || !!state.error || resume.offer !== null
  const { visible: controlsVisible, show: pokeControls } = useControlsVisibility(
    containerRef,
    state.playing,
    locked,
  )

  /* --------------------------------------------------------------- painting */

  const paint = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    const duration = video.duration
    if (!Number.isFinite(duration) || duration <= 0) return

    if (!seekingRef.current) {
      const ratio = Math.min(1, video.currentTime / duration)
      if (seekRefs.played.current) seekRefs.played.current.style.transform = `scaleX(${ratio})`
      if (seekRefs.handle.current) seekRefs.handle.current.style.left = `${ratio * 100}%`
      const root = seekRefs.root.current
      if (root) {
        root.setAttribute('aria-valuenow', String(Math.round(video.currentTime)))
        // Spoken, not a clock face: a screen reader reads "1:05" as digits.
        root.setAttribute('aria-valuetext', spokenTime(video.currentTime))
      }
      const label = formatTime(video.currentTime)
      const node = timeLabelRef.current
      if (node && node.textContent !== label) node.textContent = label
    }

    // End of the buffered range we are currently inside.
    let bufferedEnd = 0
    const ranges = video.buffered
    for (let i = 0; i < ranges.length; i++) {
      if (ranges.start(i) <= video.currentTime + 0.25 && ranges.end(i) > bufferedEnd) {
        bufferedEnd = ranges.end(i)
      }
    }
    if (seekRefs.buffered.current) {
      seekRefs.buffered.current.style.transform = `scaleX(${Math.min(1, bufferedEnd / duration)})`
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // While playing, write to the DOM every frame and never touch React state.
  useEffect(() => {
    if (!state.playing) {
      paint()
      return
    }
    let raf = 0
    const tick = () => {
      paint()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [state.playing, paint])

  /* ----------------------------------------------------------- video events */

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const onLoadedMetadata = () => {
      dispatch({ type: 'ready', duration: video.duration || 0 })
      handlersRef.current.onReady?.(video)
      paint()
    }
    const onDurationChange = () => dispatch({ type: 'duration', duration: video.duration || 0 })
    const onPlayEvent = () => {
      setEnded(false)
      setStarted(true)
      dispatch({ type: 'playing', playing: true })
      handlersRef.current.onPlay?.()
    }
    const onPlayingEvent = () => setPendingPlay(false)
    const onPauseEvent = () => {
      setPendingPlay(false)
      dispatch({ type: 'playing', playing: false })
      handlersRef.current.onPause?.()
    }
    const onEndedEvent = () => {
      setEnded(true)
      dispatch({ type: 'playing', playing: false })
      handlersRef.current.onEnded?.()
    }
    const onVolumeChange = () => dispatch({ type: 'volume', volume: video.volume, muted: video.muted })
    const onRateChange = () => dispatch({ type: 'rate', rate: video.playbackRate })
    const onProgress = () => paint()
    const onSeeked = () => paint()
    const onMediaError = () => {
      // hls.js reports its own errors separately; this only covers progressive sources.
      if (video.error) onFatal('This video could not be loaded. Check your connection and try again.')
    }

    video.addEventListener('loadedmetadata', onLoadedMetadata)
    video.addEventListener('durationchange', onDurationChange)
    video.addEventListener('play', onPlayEvent)
    video.addEventListener('playing', onPlayingEvent)
    video.addEventListener('pause', onPauseEvent)
    video.addEventListener('ended', onEndedEvent)
    video.addEventListener('volumechange', onVolumeChange)
    video.addEventListener('ratechange', onRateChange)
    video.addEventListener('progress', onProgress)
    video.addEventListener('seeked', onSeeked)
    video.addEventListener('error', onMediaError)
    return () => {
      video.removeEventListener('loadedmetadata', onLoadedMetadata)
      video.removeEventListener('durationchange', onDurationChange)
      video.removeEventListener('play', onPlayEvent)
      video.removeEventListener('playing', onPlayingEvent)
      video.removeEventListener('pause', onPauseEvent)
      video.removeEventListener('ended', onEndedEvent)
      video.removeEventListener('volumechange', onVolumeChange)
      video.removeEventListener('ratechange', onRateChange)
      video.removeEventListener('progress', onProgress)
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('error', onMediaError)
    }
  }, [dispatch, paint, onFatal])

  // Clear the started/ended marks whenever the source changes.
  useEffect(() => {
    setEnded(false)
    setStarted(false)
    setPendingPlay(false)
    startTimeRef.current = startTime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId])

  // Resume playback after a quality switch, once the new file can actually play.
  useEffect(() => {
    if (!resumeAfterSwitchRef.current || state.status !== 'ready') return
    resumeAfterSwitchRef.current = false
    const video = videoRef.current
    if (!video) return
    setPendingPlay(true)
    void video.play().catch(() => setPendingPlay(false))
  }, [state.status, state.activeSource])

  /* ------------------------------------------------------------- autoplay */

  useEffect(() => {
    const video = videoRef.current
    if (!video || !autoPlay || state.status !== 'ready') return
    setPendingPlay(true)
    video.play().catch(() => {
      // The browser blocked it. Not an error - just show the play button.
      setPendingPlay(false)
      dispatch({ type: 'blockedAutoplay', value: true })
    })
  }, [autoPlay, state.status, dispatch])

  /* ------------------------------------------------------------------ komutlar */

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused || video.ended) {
      if (video.ended) video.currentTime = 0
      setPendingPlay(true)
      void video.play().catch(() => {
        setPendingPlay(false)
        dispatch({ type: 'blockedAutoplay', value: true })
      })
    } else {
      video.pause()
    }
  }, [dispatch])

  const seekTo = useCallback((seconds: number) => {
    const video = videoRef.current
    if (!video || !Number.isFinite(video.duration)) return
    video.currentTime = Math.min(Math.max(0, seconds), video.duration)
    setEnded(false)
    paint()
  }, [paint])

  const seekBy = useCallback(
    (delta: number) => {
      const video = videoRef.current
      if (!video) return
      seekTo(video.currentTime + delta)
      showToast(delta > 0 ? `+${delta} sn` : `${delta} sn`)
    },
    [seekTo, showToast],
  )

  const seekToRatio = useCallback(
    (ratio: number) => {
      const video = videoRef.current
      if (!video || !Number.isFinite(video.duration)) return
      seekTo(video.duration * ratio)
    },
    [seekTo],
  )

  const setVolume = useCallback((value: number) => {
    const video = videoRef.current
    if (!video) return
    const v = Math.min(1, Math.max(0, value))
    video.volume = v
    video.muted = v === 0
  }, [])

  const nudgeVolume = useCallback(
    (delta: number) => {
      const video = videoRef.current
      if (!video) return
      const next = Math.min(1, Math.max(0, (video.muted ? 0 : video.volume) + delta))
      setVolume(next)
      showToast(`Ses %${Math.round(next * 100)}`)
    },
    [setVolume, showToast],
  )

  const toggleMute = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    // Unmuting from zero volume should not leave the viewer in silence.
    if (video.muted || video.volume === 0) {
      video.muted = false
      if (video.volume === 0) video.volume = 0.5
      showToast('Sound on')
    } else {
      video.muted = true
      showToast('Muted')
    }
  }, [showToast])

  const setRate = useCallback(
    (rate: number) => {
      const video = videoRef.current
      if (!video) return
      video.playbackRate = rate
      showToast(rate === 1 ? 'Normal speed' : `${rate}x`)
    },
    [showToast],
  )

  const nudgeRate = useCallback(
    (dir: 1 | -1) => {
      const video = videoRef.current
      if (!video) return
      const i = RATE_STEPS.indexOf(video.playbackRate)
      const next = RATE_STEPS[Math.min(RATE_STEPS.length - 1, Math.max(0, (i === -1 ? 3 : i) + dir))]
      setRate(next)
    },
    [setRate],
  )

  const setLevel = useCallback(
    (level: number) => {
      engine.setLevel(level)
      const label = level === -1 ? 'Auto' : (state.levels.find((l) => l.id === level)?.label ?? '')
      showToast(`Quality: ${label}`)
    },
    [engine, state.levels, showToast],
  )

  /**
   * Switches to another progressive rendition of the same video.
   *
   * The engine rebuilds the source whenever its src changes, and it already
   * seeks to `startTimeRef` on the way back up - the same path resume uses. So
   * the switch is: remember where we are, point at the other file, and press
   * play again if we were playing.
   */
  const setSource = useCallback(
    (index: number) => {
      const next = sources[index]
      const video = videoRef.current
      if (!next || index === state.activeSource) return
      if (video) {
        startTimeRef.current = video.currentTime
        if (!video.paused) setPendingPlay(true)
        resumeAfterSwitchRef.current = !video.paused
      }
      dispatch({ type: 'activeSource', index })
      showToast(`Quality: ${next.label}`)
    },
    [sources, state.activeSource, dispatch, showToast],
  )

  /**
   * Reports an audio track choice. Carrying it out belongs to the host: the
   * player cannot demux a second language out of a file on its own.
   */
  const setAudioTrack = useCallback(
    (id: number) => {
      const track = audioTracks.find((t) => t.id === id)
      onAudioTrack?.(id)
      if (track) showToast(`Audio: ${track.label}`)
    },
    [audioTracks, onAudioTrack, showToast],
  )

  /* ------------------------------------------------------- imperative handle */

  // The engine object is rebuilt on every render, so it cannot be a dependency
  // without re-publishing the handle constantly. Read it through a ref instead.
  const engineRef = useRef(engine)
  engineRef.current = engine
  const seekToRef = useRef(seekTo)
  seekToRef.current = seekTo

  useEffect(() => {
    if (!apiRef) return
    const api: XPlayerApi = {
      reload: () => engineRef.current.reload(),
      seekTo: (seconds) => seekToRef.current(seconds),
      getVideo: () => videoRef.current,
    }
    apiRef.current = api
    return () => {
      // Only clear our own handle: a remount may have published a newer one.
      if (apiRef.current === api) apiRef.current = null
    }
  }, [apiRef])

  /* -------------------------------------------------------------- subtitles */

  // `tracks` is usually an inline array at the call site, so its identity changes
  // every render. Reduce it to a value so the effect tracks content, not identity.
  const tracksKey = useMemo(
    () => tracks.map((t) => `${t.src}|${t.label}|${t.srclang}|${t.default ? 1 : 0}`).join('\n'),
    [tracks],
  )
  const tracksRef = useRef(tracks)
  tracksRef.current = tracks
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const crossOrigin = useMemo(() => (needsCrossOrigin(tracks) ? 'anonymous' : undefined), [tracksKey])

  // Pull the current text tracks into state when the source or track list changes.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const list = Array.from(video.textTracks).map((t, i) => ({
      id: i,
      label: t.label || t.language || `Subtitles ${i + 1}`,
    }))
    dispatch({ type: 'textTracks', tracks: list })
    dispatch({ type: 'activeTextTrack', index: tracksRef.current.findIndex((t) => t.default) })
  }, [tracksKey, dispatch, videoId])

  // Apply the selected subtitle track.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    Array.from(video.textTracks).forEach((t, i) => {
      t.mode = i === state.activeTextTrack ? 'showing' : 'disabled'
    })
  }, [state.activeTextTrack, state.textTracks])

  const setTextTrack = useCallback(
    (index: number) => {
      dispatch({ type: 'activeTextTrack', index })
      showToast(index === -1 ? 'Subtitles off' : (state.textTracks[index]?.label ?? 'Subtitles on'))
    },
    [dispatch, state.textTracks, showToast],
  )

  const cycleSubtitles = useCallback(() => {
    if (state.textTracks.length === 0) return
    // Toggle: turn the first track on when off, otherwise turn subtitles off.
    setTextTrack(state.activeTextTrack === -1 ? 0 : -1)
  }, [state.activeTextTrack, state.textTracks.length, setTextTrack])

  /* -------------------------------------------- full screen and picture in picture */

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current
    const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null
    if (!el) return
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {})
      return
    }
    if (el.requestFullscreen) {
      void el.requestFullscreen().catch(() => {
        // On iPhone the container cannot go full screen; the video has its own.
        video?.webkitEnterFullscreen?.()
      })
    } else {
      video?.webkitEnterFullscreen?.()
    }
  }, [])

  useEffect(() => {
    const onChange = () => {
      dispatch({ type: 'fullscreen', value: document.fullscreenElement === containerRef.current })
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [dispatch])

  const pipSupported = typeof document !== 'undefined' && 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled

  const togglePip = useCallback(() => {
    const video = videoRef.current
    if (!video || !pipSupported) return
    if (document.pictureInPictureElement) void document.exitPictureInPicture().catch(() => {})
    else void video.requestPictureInPicture().catch(() => {})
  }, [pipSupported])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const enter = () => dispatch({ type: 'pip', value: true })
    const leave = () => dispatch({ type: 'pip', value: false })
    video.addEventListener('enterpictureinpicture', enter)
    video.addEventListener('leavepictureinpicture', leave)
    return () => {
      video.removeEventListener('enterpictureinpicture', enter)
      video.removeEventListener('leavepictureinpicture', leave)
    }
  }, [dispatch])

  /* ------------------------------------------------------------------ klavye */

  const commandsRef = useRef<PlayerCommands>({} as PlayerCommands)
  commandsRef.current = {
    togglePlay,
    seekBy,
    seekToRatio,
    nudgeVolume,
    toggleMute,
    toggleFullscreen,
    togglePip,
    cycleSubtitles,
    nudgeRate,
  }
  useKeyboard(containerRef, commandsRef, pokeControls)

  /* ------------------------------------------------------ surface click / tap */

  const lastTapRef = useRef({ time: 0, x: 0 })
  /**
   * Where and when the pointer went down on the surface.
   *
   * A bare pointerup is not a click: a drag that ends over the video, or a press
   * that began somewhere else entirely, would both toggle playback. Requiring
   * the press and the release to belong together is what stops the video
   * pausing itself when someone drags across it.
   */
  const pressRef = useRef<{ id: number; x: number; y: number; at: number } | null>(null)

  const onSurfacePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    pressRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY, at: performance.now() }
  }, [])

  const onSurfacePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (state.error || resume.offer !== null) return

      const press = pressRef.current
      pressRef.current = null
      // Same pointer, barely moved, and released promptly: that is a click.
      if (
        !press ||
        press.id !== e.pointerId ||
        Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8 ||
        performance.now() - press.at > 600
      ) {
        return
      }

      if (e.pointerType === 'touch') {
        const rect = e.currentTarget.getBoundingClientRect()
        const x = e.clientX - rect.left
        const now = performance.now()
        const isDouble = now - lastTapRef.current.time < 320 && Math.abs(x - lastTapRef.current.x) < 60
        lastTapRef.current = { time: now, x }
        if (isDouble) {
          const third = rect.width / 3
          if (x < third) seekBy(-10)
          else if (x > rect.width - third) seekBy(10)
          else togglePlay()
          return
        }
        pokeControls()
        return
      }

      // Mouse: single click toggles play (a double click also toggles full screen).
      togglePlay()
    },
    [state.error, resume.offer, seekBy, togglePlay, pokeControls],
  )

  /* -------------------------------------------------------------------- render */

  const containerStyle = useMemo<CSSProperties>(
    () => ({ ...style, ...(accent ? { ['--xp-accent' as string]: accent } : null) }),
    [style, accent],
  )

  const waiting = state.waiting || (pendingPlay && !state.playing && !state.error)
  const showBigPlay = !state.playing && !pendingPlay && (!started || ended || state.blockedAutoplay) && !state.waiting

  return (
    <div
      ref={containerRef}
      className={`xp-root${controlsVisible ? ' xp-show' : ''}${state.fullscreen ? ' xp-fullscreen' : ''}${className ? ` ${className}` : ''}`}
      style={containerStyle}
      tabIndex={0}
      role="region"
      aria-label={title ? `Video player: ${title}` : 'Video player'}
      data-xp-started={started ? 'true' : 'false'}
    >
      <video
        ref={videoRef}
        className="xp-video"
        poster={poster}
        loop={loop}
        muted={muted}
        playsInline
        preload="metadata"
        crossOrigin={crossOrigin}
        disablePictureInPicture={!pipSupported}
      >
        {tracks.map((t) => (
          <track key={t.src} kind="subtitles" src={t.src} srcLang={t.srclang} label={t.label} />
        ))}
      </video>

      <div
        className="xp-surface"
        onPointerDown={onSurfacePointerDown}
        onPointerUp={onSurfacePointerUp}
        onPointerCancel={() => {
          pressRef.current = null
        }}
        onDoubleClick={(e) => {
          if (e.nativeEvent instanceof MouseEvent) toggleFullscreen()
        }}
      />

      {title && <div className="xp-titlebar">{title}</div>}

      <CenterOverlay
        waiting={waiting}
        showBigPlay={showBigPlay}
        ended={ended}
        error={state.error}
        onPlay={togglePlay}
        onRetry={() => {
          dispatch({ type: 'loading' })
          engine.reload()
        }}
      />

      <Toast toast={toast} />

      {resume.offer !== null && (
        <div className="xp-resume">
          <span>
            Resume from <strong>{formatTime(resume.offer)}</strong>?
          </span>
          <button type="button" className="xp-resume-primary" onClick={resume.acceptOffer}>
            Resume
          </button>
          <button type="button" className="xp-resume-ghost" onClick={resume.dismissOffer}>
            Start over
          </button>
        </div>
      )}

      <ControlBar
        state={state}
        sources={sources}
        audioTracks={audioTracks}
        activeAudioTrack={activeAudioTrack}
        ended={ended}
        seekRefs={seekRefs}
        timeLabelRef={timeLabelRef}
        seekingRef={seekingRef}
        pipSupported={pipSupported}
        onTogglePlay={togglePlay}
        onSeek={seekTo}
        onScrub={seekTo}
        onSeekBy={seekBy}
        onVolume={setVolume}
        onToggleMute={toggleMute}
        onRate={setRate}
        onLevel={setLevel}
        onSource={setSource}
        onTextTrack={setTextTrack}
        onAudioTrack={setAudioTrack}
        onToggleSubtitles={cycleSubtitles}
        onTogglePip={togglePip}
        onToggleFullscreen={toggleFullscreen}
        onMenuOpenChange={setMenuOpen}
        onActivity={pokeControls}
      />
    </div>
  )
}

export default XPlayer
