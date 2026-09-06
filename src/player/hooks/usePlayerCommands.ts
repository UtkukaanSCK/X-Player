import { useCallback, useEffect, type Dispatch, type RefObject } from 'react'
import type { PlayerAction, PlayerState, XPlayerAudioTrack, XPlayerSource } from '../types'
import type { VideoEngine } from './useVideoEngine'
import type { Playback } from './useMediaEvents'
import type { PlayerCommands as KeyboardCommands } from './useKeyboard'

/** The speeds the menu offers and the , and . keys step through. */
const RATE_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]
const NORMAL_RATE = RATE_STEPS.indexOf(1)

interface Options {
  videoRef: RefObject<HTMLVideoElement | null>
  containerRef: RefObject<HTMLDivElement | null>
  state: PlayerState
  dispatch: Dispatch<PlayerAction>
  engine: VideoEngine
  playback: Playback
  sources: XPlayerSource[]
  audioTracks: XPlayerAudioTrack[]
  onAudioTrack?: (id: number) => void
  /** Was playback running when the viewer switched rendition? */
  resumeAfterSwitchRef: RefObject<boolean>
  startTimeRef: RefObject<number>
  paint: () => void
  showToast: (text: string) => void
  cycleSubtitles: () => void
  pipSupported: boolean
}

export interface Commands extends KeyboardCommands {
  seekTo: (seconds: number) => void
  setVolume: (value: number) => void
  setRate: (rate: number) => void
  setLevel: (level: number) => void
  setSource: (index: number) => void
  setAudioTrack: (id: number) => void
}

/**
 * Everything the player can be asked to do, in one place.
 *
 * Each of these acts on the <video> element and then says nothing about it.
 * The element reports what happened and the state follows from that, so a
 * command the browser refuses - a blocked play, a seek past the end - leaves
 * the player describing what is true rather than what was asked for.
 */
export function usePlayerCommands({
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
}: Options): Commands {
  const { setPendingPlay, clearEnded } = playback

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (!video.paused && !video.ended) {
      video.pause()
      return
    }
    if (video.ended) video.currentTime = 0
    setPendingPlay(true)
    void video.play().catch(() => {
      // Not an error. The browser refused, so offer the play button again.
      setPendingPlay(false)
      dispatch({ type: 'blockedAutoplay', value: true })
    })
  }, [videoRef, dispatch, setPendingPlay])

  const seekTo = useCallback(
    (seconds: number) => {
      const video = videoRef.current
      if (!video || !Number.isFinite(video.duration)) return
      video.currentTime = Math.min(Math.max(0, seconds), video.duration)
      clearEnded()
      paint()
    },
    [videoRef, paint, clearEnded],
  )

  const seekBy = useCallback(
    (delta: number) => {
      const video = videoRef.current
      if (!video) return
      seekTo(video.currentTime + delta)
      showToast(delta > 0 ? `+${delta}s` : `${delta}s`)
    },
    [videoRef, seekTo, showToast],
  )

  const seekToRatio = useCallback(
    (ratio: number) => {
      const video = videoRef.current
      if (!video || !Number.isFinite(video.duration)) return
      seekTo(video.duration * ratio)
    },
    [videoRef, seekTo],
  )

  const setVolume = useCallback(
    (value: number) => {
      const video = videoRef.current
      if (!video) return
      const level = Math.min(1, Math.max(0, value))
      video.volume = level
      video.muted = level === 0
    },
    [videoRef],
  )

  const nudgeVolume = useCallback(
    (delta: number) => {
      const video = videoRef.current
      if (!video) return
      const next = Math.min(1, Math.max(0, (video.muted ? 0 : video.volume) + delta))
      setVolume(next)
      showToast(`Volume ${Math.round(next * 100)}%`)
    },
    [videoRef, setVolume, showToast],
  )

  const toggleMute = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.muted || video.volume === 0) {
      // Unmuting from zero volume should not leave the viewer in silence.
      video.muted = false
      if (video.volume === 0) video.volume = 0.5
      showToast('Sound on')
    } else {
      video.muted = true
      showToast('Muted')
    }
  }, [videoRef, showToast])

  const setRate = useCallback(
    (rate: number) => {
      const video = videoRef.current
      if (!video) return
      video.playbackRate = rate
      showToast(rate === 1 ? 'Normal speed' : `${rate}x`)
    },
    [videoRef, showToast],
  )

  const nudgeRate = useCallback(
    (dir: 1 | -1) => {
      const video = videoRef.current
      if (!video) return
      const at = RATE_STEPS.indexOf(video.playbackRate)
      const from = at === -1 ? NORMAL_RATE : at
      setRate(RATE_STEPS[Math.min(RATE_STEPS.length - 1, Math.max(0, from + dir))])
    },
    [videoRef, setRate],
  )

  const setLevel = useCallback(
    (level: number) => {
      engine.setLevel(level)
      showToast(`Quality: ${level === -1 ? 'Auto' : (state.levels.find((l) => l.id === level)?.label ?? '')}`)
    },
    [engine, state.levels, showToast],
  )

  /**
   * Switches to another progressive rendition of the same video.
   *
   * The engine rebuilds the source whenever its src changes, and on the way
   * back up it seeks to startTimeRef - the same path resume uses. So the switch
   * is: remember where we are, point at the other file, and press play again if
   * we were playing.
   */
  const setSource = useCallback(
    (index: number) => {
      const next = sources[index]
      if (!next || index === state.activeSource) return
      const video = videoRef.current
      if (video) {
        startTimeRef.current = video.currentTime
        resumeAfterSwitchRef.current = !video.paused
        if (!video.paused) setPendingPlay(true)
      }
      dispatch({ type: 'activeSource', index })
      showToast(`Quality: ${next.label}`)
    },
    [sources, state.activeSource, videoRef, startTimeRef, resumeAfterSwitchRef, setPendingPlay, dispatch, showToast],
  )

  /**
   * Reports an audio track choice. Carrying it out belongs to the host: the
   * player cannot demux a second language out of a file on its own.
   */
  const setAudioTrack = useCallback(
    (id: number) => {
      onAudioTrack?.(id)
      const track = audioTracks.find((t) => t.id === id)
      if (track) showToast(`Audio: ${track.label}`)
    },
    [audioTracks, onAudioTrack, showToast],
  )

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current
    const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null
    if (!el) return
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {})
      return
    }
    if (!el.requestFullscreen) {
      video?.webkitEnterFullscreen?.()
      return
    }
    void el.requestFullscreen().catch(() => {
      // On iPhone the container cannot go full screen; the video has its own.
      video?.webkitEnterFullscreen?.()
    })
  }, [containerRef, videoRef])

  useEffect(() => {
    const onChange = () =>
      dispatch({ type: 'fullscreen', value: document.fullscreenElement === containerRef.current })
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [containerRef, dispatch])

  const togglePip = useCallback(() => {
    const video = videoRef.current
    if (!video || !pipSupported) return
    if (document.pictureInPictureElement) void document.exitPictureInPicture().catch(() => {})
    else void video.requestPictureInPicture().catch(() => {})
  }, [videoRef, pipSupported])

  /* Resume playback after a rendition switch, once the new file can play. */
  useEffect(() => {
    if (!resumeAfterSwitchRef.current || state.status !== 'ready') return
    resumeAfterSwitchRef.current = false
    const video = videoRef.current
    if (!video) return
    setPendingPlay(true)
    void video.play().catch(() => setPendingPlay(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, state.activeSource])

  return {
    togglePlay,
    seekTo,
    seekBy,
    seekToRatio,
    setVolume,
    nudgeVolume,
    toggleMute,
    setRate,
    nudgeRate,
    setLevel,
    setSource,
    setAudioTrack,
    toggleFullscreen,
    togglePip,
    cycleSubtitles,
  }
}
