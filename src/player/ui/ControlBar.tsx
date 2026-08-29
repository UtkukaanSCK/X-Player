import type { RefObject } from 'react'
import type { PlayerState, XPlayerSource } from '../types'
import { formatTime } from '../format'
import { SeekBar, type SeekRefs } from './SeekBar'
import { SettingsMenu } from './SettingsMenu'
import { VolumeControl } from './VolumeControl'
import {
  ExitFullscreenIcon,
  FullscreenIcon,
  PauseIcon,
  PipIcon,
  PlayIcon,
  ReplayIcon,
  SeekBackIcon,
  SeekFwdIcon,
  SubtitlesIcon,
} from './Icons'

interface Props {
  state: PlayerState
  sources: XPlayerSource[]
  ended: boolean
  seekRefs: SeekRefs
  timeLabelRef: RefObject<HTMLSpanElement | null>
  seekingRef: RefObject<boolean>
  pipSupported: boolean
  onTogglePlay: () => void
  onSeek: (seconds: number) => void
  onScrub: (seconds: number) => void
  onSeekBy: (delta: number) => void
  onVolume: (value: number) => void
  onToggleMute: () => void
  onRate: (rate: number) => void
  onLevel: (level: number) => void
  onSource: (index: number) => void
  onTextTrack: (index: number) => void
  onToggleSubtitles: () => void
  onTogglePip: () => void
  onToggleFullscreen: () => void
  onMenuOpenChange: (open: boolean) => void
  onActivity: () => void
}

export function ControlBar(props: Props) {
  const { state, ended } = props
  const PlayGlyph = ended ? ReplayIcon : state.playing ? PauseIcon : PlayIcon
  const playLabel = ended ? 'Replay' : state.playing ? 'Pause' : 'Play'
  const subtitlesOn = state.activeTextTrack !== -1

  return (
    <div className="xp-controls" onPointerDown={(e) => e.stopPropagation()}>
      <SeekBar
        refs={props.seekRefs}
        duration={state.duration}
        seekingRef={props.seekingRef}
        onSeek={props.onSeek}
        onScrub={props.onScrub}
        onActivity={props.onActivity}
      />

      <div className="xp-bar">
        <div className="xp-bar-left">
          <button
            type="button"
            className="xp-btn xp-btn-play"
            onClick={props.onTogglePlay}
            aria-label={playLabel}
            data-xp-tip={`${playLabel} (k)`}
          >
            <PlayGlyph size={24} />
          </button>

          <button
            type="button"
            className="xp-btn xp-hide-sm"
            onClick={() => props.onSeekBy(-10)}
            aria-label="Back 10 seconds"
            data-xp-tip="Back 10s (j)"
          >
            <SeekBackIcon />
          </button>
          <button
            type="button"
            className="xp-btn xp-hide-sm"
            onClick={() => props.onSeekBy(10)}
            aria-label="Forward 10 seconds"
            data-xp-tip="Forward 10s (l)"
          >
            <SeekFwdIcon />
          </button>

          <VolumeControl
            volume={state.volume}
            muted={state.muted}
            onToggleMute={props.onToggleMute}
            onChange={props.onVolume}
          />

          <div className="xp-time" aria-hidden>
            <span ref={props.timeLabelRef}>0:00</span>
            <span className="xp-time-sep">/</span>
            <span className="xp-time-total">{formatTime(state.duration)}</span>
          </div>
        </div>

        <div className="xp-bar-right">
          {state.textTracks.length > 0 && (
            <button
              type="button"
              className={`xp-btn${subtitlesOn ? ' xp-btn-on' : ''}`}
              onClick={props.onToggleSubtitles}
              aria-label={subtitlesOn ? 'Turn subtitles off' : 'Turn subtitles on'}
              aria-pressed={subtitlesOn}
              data-xp-tip="Subtitles (c)"
            >
              <SubtitlesIcon />
            </button>
          )}

          <SettingsMenu
            state={state}
            sources={props.sources}
            onRate={props.onRate}
            onLevel={props.onLevel}
            onSource={props.onSource}
            onTextTrack={props.onTextTrack}
            onOpenChange={props.onMenuOpenChange}
          />

          {props.pipSupported && (
            <button
              type="button"
              className={`xp-btn xp-hide-sm${state.pip ? ' xp-btn-on' : ''}`}
              onClick={props.onTogglePip}
              aria-label="Picture in picture"
              data-xp-tip="Picture in picture (i)"
            >
              <PipIcon />
            </button>
          )}

          <button
            type="button"
            className="xp-btn"
            onClick={props.onToggleFullscreen}
            aria-label={state.fullscreen ? 'Exit full screen' : 'Full screen'}
            data-xp-tip={state.fullscreen ? 'Exit full screen (f)' : 'Full screen (f)'}
          >
            {state.fullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
          </button>
        </div>
      </div>
    </div>
  )
}
