import type { ReactNode, SVGProps } from 'react'

interface IconProps {
  size?: number
}

type Extra = SVGProps<SVGSVGElement>

/*
 * One shell, seventeen shapes.
 *
 * Every icon used to be its own component, and the seventeen bodies cost more
 * than the drawings inside them: the shapes are 1.4 kB of what this module
 * compiled to, and the rest was the same wrapper written out again each time.
 *
 * They stay components rather than becoming plain data because two call sites
 * choose one by value and render it - `const Glyph = ended ? ReplayIcon :
 * playing ? PauseIcon : PlayIcon` in the control bar, and the three volume
 * states in the volume button. Anything that turned them into strings would
 * have to rewrite those, for nothing.
 *
 * The shape is built once, when the module loads, not on every render: a React
 * element is immutable and re-using one is free.
 */
const shell =
  (shape: ReactNode, fallback: number, extra?: Extra) =>
  ({ size = fallback }: IconProps) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable={false}
      {...extra}
    >
      {shape}
    </svg>
  )

/** The common case: one or more stroked paths and nothing else. */
const drawn = (d: string[], fallback = 22, extra?: Extra) =>
  shell(
    d.map((path) => <path key={path} d={path} />),
    fallback,
    extra,
  )

/** Filled glyphs paint the shape rather than outlining it. */
const solid: Extra = { fill: 'currentColor', stroke: 'none' }

/** The speaker cone, shared by all three volume states. */
const cone = <path d="M4 9.5h3.2L12 5.6v12.8l-4.8-3.9H4z" fill="currentColor" stroke="none" />

export const PlayIcon = drawn(['M8 5.2c0-.9 1-1.5 1.8-1l9 6.8c.7.5.7 1.5 0 2l-9 6.8c-.8.5-1.8-.1-1.8-1V5.2Z'], 22, solid)

export const PauseIcon = shell(
  <>
    <rect x="6" y="4.5" width="4" height="15" rx="1.4" />
    <rect x="14" y="4.5" width="4" height="15" rx="1.4" />
  </>,
  22,
  solid,
)

export const ReplayIcon = drawn(['M20 12a8 8 0 1 1-2.6-5.9', 'M20 4v4h-4'])

export const SeekBackIcon = drawn(['M11 5 4 12l7 7', 'M20 5l-7 7 7 7'])

export const SeekFwdIcon = drawn(['M13 5l7 7-7 7', 'M4 5l7 7-7 7'])

export const VolumeHighIcon = shell(
  <>
    {cone}
    <path d="M15.6 9a4 4 0 0 1 0 6" />
    <path d="M18.2 6.6a7.5 7.5 0 0 1 0 10.8" />
  </>,
  22,
)

export const VolumeLowIcon = shell(
  <>
    {cone}
    <path d="M15.6 9a4 4 0 0 1 0 6" />
  </>,
  22,
)

export const VolumeMuteIcon = shell(
  <>
    {cone}
    <path d="m16 9.5 4.5 5M20.5 9.5 16 14.5" />
  </>,
  22,
)

export const SettingsIcon = shell(
  <>
    <circle cx="12" cy="12" r="2.9" />
    <path d="M19.4 14.4a1.6 1.6 0 0 0 .3 1.8l.1.1a1.9 1.9 0 1 1-2.7 2.7l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a1.9 1.9 0 1 1-3.8 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a1.9 1.9 0 1 1-2.7-2.7l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3.4a1.9 1.9 0 1 1 0-3.8h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a1.9 1.9 0 1 1 2.7-2.7l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5V3.4a1.9 1.9 0 1 1 3.8 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a1.9 1.9 0 1 1 2.7 2.7l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1h.2a1.9 1.9 0 1 1 0 3.8h-.1a1.6 1.6 0 0 0-1.5 1Z" />
  </>,
  22,
)

export const SubtitlesIcon = shell(
  <>
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <path d="M7 14.2h4M13 14.2h4M7 10.4h2.5M11.5 10.4H17" />
  </>,
  22,
)

export const PipIcon = shell(
  <>
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <rect x="12" y="11" width="7" height="6" rx="1.6" fill="currentColor" stroke="none" />
  </>,
  22,
)

export const FullscreenIcon = drawn([
  'M4 9V5.8A1.8 1.8 0 0 1 5.8 4H9M15 4h3.2A1.8 1.8 0 0 1 20 5.8V9M20 15v3.2a1.8 1.8 0 0 1-1.8 1.8H15M9 20H5.8A1.8 1.8 0 0 1 4 18.2V15',
])

export const ExitFullscreenIcon = drawn([
  'M9 4v3.2A1.8 1.8 0 0 1 7.2 9H4M20 9h-3.2A1.8 1.8 0 0 1 15 7.2V4M15 20v-3.2a1.8 1.8 0 0 1 1.8-1.8H20M4 15h3.2A1.8 1.8 0 0 1 9 16.8V20',
])

export const CheckIcon = drawn(['m4.5 12.5 5 5 10-11'], 16, { strokeWidth: 2.4 })

export const ChevronRightIcon = drawn(['m9 5 7 7-7 7'], 16)

export const ChevronLeftIcon = drawn(['m15 5-7 7 7 7'], 16)

export const WarningIcon = drawn(['M12 3.8 21.2 19H2.8L12 3.8Z', 'M12 10v4.2M12 17.2v.2'], 28)
