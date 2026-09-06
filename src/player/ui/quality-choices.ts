import type { PlayerState, XPlayerSource } from '../types'

export interface QualityChoice {
  key: string
  label: string
  checked: boolean
  select: () => void
}

export interface QualityChoices {
  /** What is playing right now, not what was asked for: on auto the two differ. */
  label: string
  auto: boolean
  options: QualityChoice[]
}

/**
 * The single place that decides what "quality" means for a given player.
 *
 * Two different things are called quality here and only one applies at a time:
 * the renditions an HLS stream declares, or separate files the caller passed.
 * A stream can report a single nameless rendition - a plain media playlist does
 * exactly that - and offering a menu whose only entry reads "Unknown" is worse
 * than offering nothing. So renditions only drive the menu when there is
 * genuinely a choice among them, and named sources always win.
 *
 * It lives apart from both callers because quality appears in two places that
 * must never disagree: its own button on a wide player, and a settings row on a
 * narrow one. Two copies of this would have to stay in step forever, and the
 * first time they drifted the same video would offer two different lists
 * depending on how wide its player happened to be.
 *
 * Returns null when there is nothing to choose between, which is the caller's
 * signal to render nothing at all rather than an empty menu.
 */
export function qualityChoices(
  state: PlayerState,
  sources: XPlayerSource[],
  onLevel: (level: number) => void,
  onSource: (index: number) => void,
): QualityChoices | null {
  const hasSources = sources.length > 1
  const hasLevels = !hasSources && state.levels.length > 1
  if (!hasLevels && !hasSources) return null

  const activeLevel = state.levels.find((l) => l.id === state.activeLevel)
  const auto = hasLevels && state.selectedLevel === -1

  const label = hasLevels
    ? (activeLevel?.label ?? (auto ? 'Auto' : 'Quality'))
    : (sources[state.activeSource]?.label ?? sources[0].label)

  const options: QualityChoice[] = hasLevels
    ? [
        {
          key: 'auto',
          label: `Auto${activeLevel ? ` (${activeLevel.label})` : ''}`,
          checked: state.selectedLevel === -1,
          select: () => onLevel(-1),
        },
        ...state.levels.map((level) => ({
          key: String(level.id),
          label: level.label,
          checked: state.selectedLevel === level.id,
          select: () => onLevel(level.id),
        })),
      ]
    : sources.map((source, index) => ({
        key: source.src,
        label: source.label,
        checked: state.activeSource === index,
        select: () => onSource(index),
      }))

  return { label, auto, options }
}
