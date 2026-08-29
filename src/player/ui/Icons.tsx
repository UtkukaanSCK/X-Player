interface IconProps {
  size?: number
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false as const,
})

export const PlayIcon = ({ size = 22 }: IconProps) => (
  <svg {...base(size)} fill="currentColor" stroke="none">
    <path d="M8 5.2c0-.9 1-1.5 1.8-1l9 6.8c.7.5.7 1.5 0 2l-9 6.8c-.8.5-1.8-.1-1.8-1V5.2Z" />
  </svg>
)

export const PauseIcon = ({ size = 22 }: IconProps) => (
  <svg {...base(size)} fill="currentColor" stroke="none">
    <rect x="6" y="4.5" width="4" height="15" rx="1.4" />
    <rect x="14" y="4.5" width="4" height="15" rx="1.4" />
  </svg>
)

export const ReplayIcon = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M20 12a8 8 0 1 1-2.6-5.9" />
    <path d="M20 4v4h-4" />
  </svg>
)

export const SeekBackIcon = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M11 5 4 12l7 7" />
    <path d="M20 5l-7 7 7 7" />
  </svg>
)

export const SeekFwdIcon = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M13 5l7 7-7 7" />
    <path d="M4 5l7 7-7 7" />
  </svg>
)

export const VolumeHighIcon = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M4 9.5h3.2L12 5.6v12.8l-4.8-3.9H4z" fill="currentColor" stroke="none" />
    <path d="M15.6 9a4 4 0 0 1 0 6" />
    <path d="M18.2 6.6a7.5 7.5 0 0 1 0 10.8" />
  </svg>
)

export const VolumeLowIcon = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M4 9.5h3.2L12 5.6v12.8l-4.8-3.9H4z" fill="currentColor" stroke="none" />
    <path d="M15.6 9a4 4 0 0 1 0 6" />
  </svg>
)

export const VolumeMuteIcon = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M4 9.5h3.2L12 5.6v12.8l-4.8-3.9H4z" fill="currentColor" stroke="none" />
    <path d="m16 9.5 4.5 5M20.5 9.5 16 14.5" />
  </svg>
)

export const SettingsIcon = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="2.9" />
    <path d="M19.4 14.4a1.6 1.6 0 0 0 .3 1.8l.1.1a1.9 1.9 0 1 1-2.7 2.7l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a1.9 1.9 0 1 1-3.8 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a1.9 1.9 0 1 1-2.7-2.7l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3.4a1.9 1.9 0 1 1 0-3.8h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a1.9 1.9 0 1 1 2.7-2.7l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5V3.4a1.9 1.9 0 1 1 3.8 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a1.9 1.9 0 1 1 2.7 2.7l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1h.2a1.9 1.9 0 1 1 0 3.8h-.1a1.6 1.6 0 0 0-1.5 1Z" />
  </svg>
)

export const SubtitlesIcon = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <path d="M7 14.2h4M13 14.2h4M7 10.4h2.5M11.5 10.4H17" />
  </svg>
)

export const PipIcon = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <rect x="12" y="11" width="7" height="6" rx="1.6" fill="currentColor" stroke="none" />
  </svg>
)

export const FullscreenIcon = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M4 9V5.8A1.8 1.8 0 0 1 5.8 4H9M15 4h3.2A1.8 1.8 0 0 1 20 5.8V9M20 15v3.2a1.8 1.8 0 0 1-1.8 1.8H15M9 20H5.8A1.8 1.8 0 0 1 4 18.2V15" />
  </svg>
)

export const ExitFullscreenIcon = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M9 4v3.2A1.8 1.8 0 0 1 7.2 9H4M20 9h-3.2A1.8 1.8 0 0 1 15 7.2V4M15 20v-3.2a1.8 1.8 0 0 1 1.8-1.8H20M4 15h3.2A1.8 1.8 0 0 1 9 16.8V20" />
  </svg>
)

export const CheckIcon = ({ size = 16 }: IconProps) => (
  <svg {...base(size)} strokeWidth={2.4}>
    <path d="m4.5 12.5 5 5 10-11" />
  </svg>
)

export const ChevronRightIcon = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <path d="m9 5 7 7-7 7" />
  </svg>
)

export const ChevronLeftIcon = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <path d="m15 5-7 7 7 7" />
  </svg>
)

export const WarningIcon = ({ size = 28 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M12 3.8 21.2 19H2.8L12 3.8Z" />
    <path d="M12 10v4.2M12 17.2v.2" />
  </svg>
)
