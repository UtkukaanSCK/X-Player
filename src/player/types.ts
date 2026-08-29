import type { CSSProperties } from 'react'

/** One subtitle track (WebVTT). */
export interface XPlayerTrack {
  src: string
  label: string
  /** BCP-47 language tag, e.g. "en", "tr" */
  srclang: string
  default?: boolean
}

/** An HLS quality level. Empty for native playback. */
export interface QualityLevel {
  id: number
  height: number
  bitrate: number
  label: string
}

export type SourceKind = 'auto' | 'hls' | 'native'

/**
 * One rendition of the same video, for the quality menu.
 *
 * A single progressive file has nothing to choose between, so the quality menu
 * only appears for HLS. Pass several of these and it appears for plain MP4 or
 * WebM too, listing exactly the labels given here.
 */
export interface XPlayerSource {
  src: string
  /** Shown in the quality menu, e.g. "480p". Say what the file really is. */
  label: string
  type?: SourceKind
}

export interface XPlayerProps {
  /**
   * Video URL: .mp4/.webm or .m3u8 (a blob: URL works too).
   * Optional when `sources` is given, in which case the first one is used.
   */
  src?: string
  /** Several renditions of the same video, offered in the quality menu. */
  sources?: XPlayerSource[]
  /** Source kind. Defaults to "auto", which reads the file extension. */
  type?: SourceKind
  poster?: string
  /** Shown in the top-left. With no title the bar is not rendered at all. */
  title?: string
  autoPlay?: boolean
  muted?: boolean
  loop?: boolean
  /** Start position in seconds. */
  startTime?: number
  /** Accent color (any CSS color). Overrides the --xp-accent variable. */
  accent?: string
  tracks?: XPlayerTrack[]
  /** Whether to offer resuming where the viewer left off. Default: on. */
  rememberPosition?: boolean
  /** Key used to remember the position. Defaults to src. */
  storageKey?: string
  className?: string
  style?: CSSProperties
  onReady?: (video: HTMLVideoElement) => void
  onPlay?: () => void
  onPause?: () => void
  onEnded?: () => void
  onError?: (message: string) => void
}

export interface PlayerState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  playing: boolean
  /** Buffering or stalled. */
  waiting: boolean
  duration: number
  volume: number
  muted: boolean
  rate: number
  levels: QualityLevel[]
  /** -1 = automatic */
  selectedLevel: number
  /** The level actually playing while in automatic mode. */
  activeLevel: number
  textTracks: { id: number; label: string }[]
  activeTextTrack: number
  /** Index into `sources` when the caller supplied several renditions. */
  activeSource: number
  fullscreen: boolean
  pip: boolean
  error: string | null
  /** The browser blocked autoplay. */
  blockedAutoplay: boolean
}

export type PlayerAction =
  | { type: 'reset' }
  | { type: 'loading' }
  | { type: 'ready'; duration: number }
  | { type: 'duration'; duration: number }
  | { type: 'playing'; playing: boolean }
  | { type: 'waiting'; waiting: boolean }
  | { type: 'volume'; volume: number; muted: boolean }
  | { type: 'rate'; rate: number }
  | { type: 'levels'; levels: QualityLevel[] }
  | { type: 'selectedLevel'; level: number }
  | { type: 'activeLevel'; level: number }
  | { type: 'textTracks'; tracks: { id: number; label: string }[] }
  | { type: 'activeTextTrack'; index: number }
  | { type: 'activeSource'; index: number }
  | { type: 'fullscreen'; value: boolean }
  | { type: 'pip'; value: boolean }
  | { type: 'error'; message: string }
  | { type: 'blockedAutoplay'; value: boolean }
