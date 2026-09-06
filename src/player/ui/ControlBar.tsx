import type { RefObject } from 'react'
import type { PlayerState, XPlayerAudioTrack, XPlayerSource } from '../types'
import { formatTime } from '../format'
import { SeekBar, type SeekRefs } from './SeekBar'
import type { FramePreview } from '../hooks/useFramePreview'
import { SettingsMenu } from './SettingsMenu'
import { QualityMenu } from './QualityMenu'
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
  audioTracks: XPlayerAudioTrack[]
  activeAudioTrack: number
  ended: boolean
  seekRefs: SeekRefs
  timeLabelRef: RefObject<HTMLSpanElement | null>
  seekingRef: RefObject<boolean>
  /** Draws a dragged-to position, through the same painter the play loop uses. */
  drawRatio: (ratio: number, duration: number) => void
  /** The frame under the pointer on the seek bar. */
  preview: FramePreview
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
  onAudioTrack: (id: number) => void
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
        drawRatio={props.drawRatio}
        preview={props.preview}
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

          {/* Both go at the first tier: the double-tap gesture on the picture
              does the same job, and it is the only control here with a
              replacement rather than a new home. */}
          <button
            type="button"
            className="xp-btn"
            data-xp-until="roomy"
            onClick={() => props.onSeekBy(-10)}
            aria-label="Back 10 seconds"
            data-xp-tip="Back 10s (j)"
          >
            <SeekBackIcon />
          </button>
          <button
            type="button"
            className="xp-btn"
            data-xp-until="roomy"
            onClick={() => props.onSeekBy(10)}
            aria-label="Forward 10 seconds"
            data-xp-tip="Forward 10s (l)"
          >
            <SeekFwdIcon />
          </button>

          {/* Last of the left group to go, and only at the narrowest tier: an
              embed that autoplays muted is a silent video, and with no way to
              unmute there is no way to recover from that. */}
          <div data-xp-until="minimal" className="xp-volume-wrap">
            <VolumeControl
              volume={state.volume}
              muted={state.muted}
              onToggleMute={props.onToggleMute}
              onChange={props.onVolume}
            />
          </div>

          {/* aria-hidden already: the spoken position comes from the slider's
              own aria-valuetext, so dropping the label costs assistive
              technology nothing, and the seek tooltip still carries it. */}
          <div className="xp-time" data-xp-until="minimal" aria-hidden>
            <span ref={props.timeLabelRef}>0:00</span>
            <span className="xp-time-sep" data-xp-until="roomy">
              /
            </span>
            <span className="xp-time-total" data-xp-until="roomy">
              {formatTime(state.duration)}
            </span>
          </div>
        </div>

        <div className="xp-bar-right">
          {state.textTracks.length > 0 && (
            <button
              type="button"
              className={`xp-btn${subtitlesOn ? ' xp-btn-on' : ''}`}
              data-xp-until="tight"
              onClick={props.onToggleSubtitles}
              aria-label={subtitlesOn ? 'Turn subtitles off' : 'Turn subtitles on'}
              aria-pressed={subtitlesOn}
              data-xp-tip="Subtitles (c)"
            >
              <SubtitlesIcon />
            </button>
          )}

          {/* The widest item on the bar, so it goes before full screen or
              settings - but it measures 288px of bar against 338px available
              at 350px wide, so it survives that tier rather than leaving at
              the first sign of pressure. One click is worth a lot on a bad
              connection and that is exactly when a small player is in use. */}
          <div data-xp-until="tight" className="xp-quality-wrap">
            <QualityMenu
              state={state}
              sources={props.sources}
              onLevel={props.onLevel}
              onSource={props.onSource}
              onOpenChange={props.onMenuOpenChange}
            />
          </div>

          {/* Given the quality and sound props as well: it shows rows for both
              at exactly the widths where the bar above has dropped their
              buttons, so nothing the bar sheds becomes unreachable. */}
          <SettingsMenu
            state={state}
            audioTracks={props.audioTracks}
            activeAudioTrack={props.activeAudioTrack}
            sources={props.sources}
            onRate={props.onRate}
            onTextTrack={props.onTextTrack}
            onAudioTrack={props.onAudioTrack}
            onLevel={props.onLevel}
            onSource={props.onSource}
            onToggleMute={props.onToggleMute}
            onOpenChange={props.onMenuOpenChange}
          />

          {props.pipSupported && (
            <button
              type="button"
              className={`xp-btn${state.pip ? ' xp-btn-on' : ''}`}
              data-xp-until="roomy"
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
