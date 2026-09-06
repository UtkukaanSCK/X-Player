import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { XPlayerApi, XPlayerAudioTrack, XPlayerProps, XPlayerSource, XPlayerTrack } from './types'
import { usePlayerState } from './hooks/usePlayerState'
import { useProgressPaint, type SeekRefs } from './hooks/useProgressPaint'
import { useMediaEvents } from './hooks/useMediaEvents'
import { useVideoEngine, isHlsSource } from './hooks/useVideoEngine'
import { useFramePreview } from './hooks/useFramePreview'
import { useStallGuard } from './hooks/useStallGuard'
import { useResume } from './hooks/useResume'
import { useSubtitles } from './hooks/useSubtitles'
import { usePlayerCommands } from './hooks/usePlayerCommands'
import { useControlsVisibility } from './hooks/useControlsVisibility'
import { useSurfaceGestures } from './hooks/useSurfaceGestures'
import { useFocusRecovery } from './hooks/useFocusRecovery'
import { useKeyboard, type PlayerCommands } from './hooks/useKeyboard'
import { ControlBar } from './ui/ControlBar'
import { CenterOverlay } from './ui/CenterOverlay'
import { Toast, useToast } from './ui/Toast'
import { formatTime } from './format'
import './styles/player.css'

/** Stable defaults, so a fresh array is not created on every render. */
const NO_TRACKS: XPlayerTrack[] = []
const NO_SOURCES: XPlayerSource[] = []
const NO_AUDIO: XPlayerAudioTrack[] = []

/**
 * The player.
 *
 * This file wires the pieces together and draws them; every behaviour lives in
 * a hook of its own. The order below is the only thing here that is not
 * arbitrary - painting comes before the events that trigger it, the element's
 * events before the engine that reports failures through them, and the
 * controls' visibility before the gestures that poke it.
 */
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
  const timeLabelRef = useRef<HTMLSpanElement>(null)
  const seekingRef = useRef(false)
  const startTimeRef = useRef(startTime)
  /** Was playback running when the viewer switched rendition? */
  const resumeAfterSwitchRef = useRef(false)

  const seekRoot = useRef<HTMLDivElement>(null)
  const seekPlayed = useRef<HTMLDivElement>(null)
  const seekBuffered = useRef<HTMLDivElement>(null)
  const seekHandle = useRef<HTMLDivElement>(null)
  const seekRefs = useMemo<SeekRefs>(
    () => ({ root: seekRoot, played: seekPlayed, buffered: seekBuffered, handle: seekHandle }),
    [],
  )

  const [state, dispatch] = usePlayerState()
  const [menuOpen, setMenuOpen] = useState(false)
  const { toast, show: showToast } = useToast()

  /*
   * Which video this is, independent of which rendition is playing: switching
   * quality must not look like a different video to anything downstream. The
   * source actually attached is a separate question - an explicit src wins,
   * otherwise it is whichever rendition is selected.
   */
  const videoId = storageKey ?? src ?? sources[0]?.src ?? ''
  const chosen = sources[state.activeSource] ?? sources[0]
  const activeSrc = src ?? chosen?.src ?? ''
  const activeType = src ? type : (chosen?.type ?? type)

  const { paint, drawRatio } = useProgressPaint({
    videoRef,
    refs: seekRefs,
    timeLabelRef,
    seekingRef,
    playing: state.playing,
  })

  const playback = useMediaEvents({
    videoRef,
    videoId,
    startTime,
    startTimeRef,
    dispatch,
    paint,
    handlers: { onReady, onPlay, onPause, onEnded, onError },
  })

  const engine = useVideoEngine({
    videoRef,
    src: activeSrc,
    type: activeType,
    startTimeRef,
    dispatch,
    onFatal: playback.fatal,
  })

  useStallGuard({ videoRef, playing: state.playing, dispatch, softRecover: engine.softRecover })

  const resume = useResume(videoRef, videoId, rememberPosition, storageKey)

  const { crossOrigin, setTextTrack, cycleSubtitles } = useSubtitles({
    videoRef,
    tracks,
    videoId,
    activeTextTrack: state.activeTextTrack,
    textTracks: state.textTracks,
    dispatch,
    showToast,
  })

  const preview = useFramePreview({ src: activeSrc, isStream: isHlsSource(activeSrc, activeType) })

  const pipSupported =
    typeof document !== 'undefined' && 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled

  const commands = usePlayerCommands({
    videoRef,
    containerRef,
    state,
    dispatch,
    engine,
    playback,
    sources,
    audioTracks,
    onAudioTrack,
    resumeAfterSwitchRef,
    startTimeRef,
    paint,
    showToast,
    cycleSubtitles,
    pipSupported,
  })

  /* Nothing may hide the controls while a menu, an error or the offer is up. */
  const locked = menuOpen || !!state.error || resume.offer !== null
  const { visible: controlsVisible, show: pokeControls } = useControlsVisibility(
    containerRef,
    state.playing,
    locked,
  )

  useFocusRecovery(containerRef)

  const commandsRef = useRef<PlayerCommands>(commands)
  commandsRef.current = commands
  useKeyboard(containerRef, commandsRef, pokeControls)

  const surface = useSurfaceGestures({
    enabled: !state.error && resume.offer === null,
    togglePlay: commands.togglePlay,
    seekBy: commands.seekBy,
    toggleFullscreen: commands.toggleFullscreen,
    onActivity: pokeControls,
  })

  /* -------------------------------------------------------------- autoplay */

  useEffect(() => {
    const video = videoRef.current
    if (!video || !autoPlay || state.status !== 'ready') return
    playback.setPendingPlay(true)
    video.play().catch(() => {
      // The browser blocked it. Not an error - just show the play button.
      playback.setPendingPlay(false)
      dispatch({ type: 'blockedAutoplay', value: true })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, state.status, dispatch])

  /* ------------------------------------------------------- imperative handle */

  // The engine and the commands are rebuilt on every render, so neither can be
  // a dependency without re-publishing the handle constantly. Read them through
  // refs instead.
  const engineRef = useRef(engine)
  engineRef.current = engine
  const seekToRef = useRef(commands.seekTo)
  seekToRef.current = commands.seekTo

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

  /* -------------------------------------------------------------- rendering */

  const containerStyle = useMemo<CSSProperties>(
    () => ({ ...style, ...(accent ? { ['--xp-accent' as string]: accent } : null) }),
    [style, accent],
  )

  const { ended, started, pendingPlay } = playback
  const waiting = state.waiting || (pendingPlay && !state.playing && !state.error)
  const showBigPlay =
    !state.playing && !pendingPlay && (!started || ended || state.blockedAutoplay) && !state.waiting

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
        onPointerDown={surface.onPointerDown}
        onPointerUp={surface.onPointerUp}
        onPointerCancel={surface.onPointerCancel}
        onDoubleClick={surface.onDoubleClick}
      />

      {title && <div className="xp-titlebar">{title}</div>}

      <CenterOverlay
        waiting={waiting}
        showBigPlay={showBigPlay}
        ended={ended}
        error={state.error}
        onPlay={commands.togglePlay}
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
        drawRatio={drawRatio}
        preview={preview}
        pipSupported={pipSupported}
        onTogglePlay={commands.togglePlay}
        onSeek={commands.seekTo}
        onScrub={commands.seekTo}
        onSeekBy={commands.seekBy}
        onVolume={commands.setVolume}
        onToggleMute={commands.toggleMute}
        onRate={commands.setRate}
        onLevel={commands.setLevel}
        onSource={commands.setSource}
        onTextTrack={setTextTrack}
        onAudioTrack={commands.setAudioTrack}
        onToggleSubtitles={cycleSubtitles}
        onTogglePip={commands.togglePip}
        onToggleFullscreen={commands.toggleFullscreen}
        onMenuOpenChange={setMenuOpen}
        onActivity={pokeControls}
      />
    </div>
  )
}

export default XPlayer
