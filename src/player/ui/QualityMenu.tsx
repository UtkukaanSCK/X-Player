import type { PlayerState, XPlayerSource } from '../types'
import { Option } from './MenuItem'
import { qualityChoices } from './quality-choices'
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
  const choices = qualityChoices(state, sources, onLevel, onSource)
  if (!choices) return null
  const { label, auto, options } = choices

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
            {options.map((option) => (
              <Option
                key={option.key}
                checked={option.checked}
                label={option.label}
                onSelect={choose(option.select)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
