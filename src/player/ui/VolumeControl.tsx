import { VolumeHighIcon, VolumeLowIcon, VolumeMuteIcon } from './Icons'

interface Props {
  volume: number
  muted: boolean
  onToggleMute: () => void
  onChange: (value: number) => void
}

export function VolumeControl({ volume, muted, onToggleMute, onChange }: Props) {
  const effective = muted ? 0 : volume
  const Icon = effective === 0 ? VolumeMuteIcon : effective < 0.5 ? VolumeLowIcon : VolumeHighIcon
  const percent = Math.round(effective * 100)

  return (
    <div className="xp-volume">
      <button
        type="button"
        className="xp-btn"
        onClick={onToggleMute}
        aria-label={muted || volume === 0 ? 'Unmute' : 'Mute'}
        data-xp-tip={muted || volume === 0 ? 'Unmute (m)' : 'Mute (m)'}
      >
        <Icon />
      </button>
      <div className="xp-volume-slider">
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={effective}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="Volume"
          aria-valuetext={`Volume ${percent}%`}
          style={{ ['--xp-fill' as string]: `${percent}%` }}
        />
      </div>
    </div>
  )
}
