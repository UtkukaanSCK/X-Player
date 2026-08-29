import type { PlayerState, XPlayerSource } from '../types'
import { CheckIcon } from './Icons'
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

  const hasLevels = state.levels.length > 0
  const hasSources = sources.length > 1
  if (!hasLevels && !hasSources) return null

  const activeLevel = state.levels.find((l) => l.id === state.activeLevel)
  const auto = hasLevels && state.selectedLevel === -1

  // What is playing right now, not what was asked for: on auto the two differ.
  const label = hasLevels
    ? (activeLevel?.label ?? (auto ? 'Auto' : 'Quality'))
    : (sources[state.activeSource]?.label ?? sources[0].label)

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
                <button
                  type="button"
                  className="xp-menu-item xp-menu-option"
                  role="menuitemradio"
                  aria-checked={state.selectedLevel === -1}
                  onClick={() => {
                    onLevel(-1)
                    setOpen(false)
                  }}
                >
                  <span className="xp-menu-check">{state.selectedLevel === -1 && <CheckIcon />}</span>
                  <span>Auto{activeLevel ? ` (${activeLevel.label})` : ''}</span>
                </button>
                {state.levels.map((lv) => (
                  <button
                    key={lv.id}
                    type="button"
                    className="xp-menu-item xp-menu-option"
                    role="menuitemradio"
                    aria-checked={state.selectedLevel === lv.id}
                    onClick={() => {
                      onLevel(lv.id)
                      setOpen(false)
                    }}
                  >
                    <span className="xp-menu-check">{state.selectedLevel === lv.id && <CheckIcon />}</span>
                    <span>{lv.label}</span>
                  </button>
                ))}
              </>
            ) : (
              sources.map((source, i) => (
                <button
                  key={source.src}
                  type="button"
                  className="xp-menu-item xp-menu-option"
                  role="menuitemradio"
                  aria-checked={state.activeSource === i}
                  onClick={() => {
                    onSource(i)
                    setOpen(false)
                  }}
                >
                  <span className="xp-menu-check">{state.activeSource === i && <CheckIcon />}</span>
                  <span>{source.label}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
