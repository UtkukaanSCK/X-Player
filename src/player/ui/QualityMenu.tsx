import type { PlayerState, XPlayerSource } from '../types'
import { Option } from './MenuItem'
import { useMenu } from './useMenu'

interface Props {
  state: PlayerState
  /** Progressive renditions, when the caller supplied several. */
  sources: XPlayerSource[]
  onLevel: (level: number) => void
  onSource: (index: number) => void
  onOpenChange: (open: boolean) => void
}

/**
 * Quality gets its own button on the control bar rather than a row inside the
 * settings menu.
 *
 * It is the setting people reach for on a bad connection, and burying it two
 * clicks deep means it may as well not exist. The button shows the resolution
 * currently playing, so the answer to "what am I watching?" is on screen without
 * opening anything.
 *
 * Two different things are called quality here and only one applies at a time:
 * the renditions an HLS stream declares, or separate files the caller passed.
 * A single progressive file has nothing to choose between, so nothing renders.
 */
export function QualityMenu({ state, sources, onLevel, onSource, onOpenChange }: Props) {
  const { open, setOpen, wrapRef, buttonRef } = useMenu(onOpenChange)

  /*
   * An explicit list from the caller wins over whatever the stream declares.
   *
   * A stream can report a single nameless rendition - a plain media playlist
   * does exactly that - and offering a menu whose only entry reads "Unknown"
   * is worse than offering nothing. So renditions only drive the menu when
   * there is genuinely a choice among them, and named sources always win.
   */
  const hasSources = sources.length > 1
  const hasLevels = !hasSources && state.levels.length > 1
  if (!hasLevels && !hasSources) return null

  const activeLevel = state.levels.find((l) => l.id === state.activeLevel)
  const auto = hasLevels && state.selectedLevel === -1

  // What is playing right now, not what was asked for: on auto the two differ.
  const label = hasLevels
    ? (activeLevel?.label ?? (auto ? 'Auto' : 'Quality'))
    : (sources[state.activeSource]?.label ?? sources[0].label)

  const choose = (pick: () => void) => () => {
    pick()
    setOpen(false)
  }

  return (
    <div className="xp-quality" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className={`xp-btn xp-btn-text${open ? ' xp-btn-active' : ''}`}
        aria-label={`Quality, currently ${label}${auto ? ', chosen automatically' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        data-xp-tip="Quality"
        onClick={() => setOpen(!open)}
      >
        <span className="xp-quality-label">{label}</span>
        {auto && <span className="xp-quality-auto">auto</span>}
      </button>

      {open && (
        <div className="xp-menu xp-menu-compact" role="menu">
          <div className="xp-menu-panel">
            {hasLevels ? (
              <>
                <Option
                  checked={state.selectedLevel === -1}
                  label={`Auto${activeLevel ? ` (${activeLevel.label})` : ''}`}
                  onSelect={choose(() => onLevel(-1))}
                />
                {state.levels.map((lv) => (
                  <Option
                    key={lv.id}
                    checked={state.selectedLevel === lv.id}
                    label={lv.label}
                    onSelect={choose(() => onLevel(lv.id))}
                  />
                ))}
              </>
            ) : (
              sources.map((source, i) => (
                <Option
                  key={source.src}
                  checked={state.activeSource === i}
                  label={source.label}
                  onSelect={choose(() => onSource(i))}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
