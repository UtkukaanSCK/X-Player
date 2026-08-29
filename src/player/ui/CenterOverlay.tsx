import { PlayIcon, ReplayIcon, WarningIcon } from './Icons'

interface Props {
  /** Buffering. */
  waiting: boolean
  /** Never started - show the big play button. */
  showBigPlay: boolean
  ended: boolean
  error: string | null
  onPlay: () => void
  onRetry: () => void
}

export function CenterOverlay({ waiting, showBigPlay, ended, error, onPlay, onRetry }: Props) {
  if (error) {
    return (
      <div className="xp-center xp-center-blocking">
        <div className="xp-error">
          <WarningIcon />
          <p className="xp-error-text">{error}</p>
          <button type="button" className="xp-error-retry" onClick={onRetry}>
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (waiting) {
    return (
      <div className="xp-center">
        <div className="xp-spinner" role="status" aria-label="Loading" />
      </div>
    )
  }

  if (showBigPlay) {
    return (
      <div className="xp-center xp-center-blocking">
        <button type="button" className="xp-bigplay" onClick={onPlay} aria-label={ended ? 'Replay' : 'Play'}>
          {ended ? <ReplayIcon size={34} /> : <PlayIcon size={34} />}
        </button>
      </div>
    )
  }

  return null
}
