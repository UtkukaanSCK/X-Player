import { CheckIcon, ChevronRightIcon } from './Icons'

/**
 * One choice in a menu: a tick when it is the current one, and a label.
 *
 * Both menus are lists of these - seven lists between them, once written out
 * seven times. Anything true of a menu choice is true here: that it announces
 * itself as a radio, that the tick has a place reserved whether or not it is
 * drawn, so the labels line up either way.
 */
export function Option({
  checked,
  label,
  onSelect,
}: {
  checked: boolean
  label: string
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      className="xp-menu-item xp-menu-option"
      role="menuitemradio"
      aria-checked={checked}
      onClick={onSelect}
    >
      <span className="xp-menu-check">{checked && <CheckIcon />}</span>
      <span>{label}</span>
    </button>
  )
}

/** A row that opens a sub-panel, saying what is chosen without opening it. */
export function Row({ label, value, onOpen }: { label: string; value: string; onOpen: () => void }) {
  return (
    <button type="button" className="xp-menu-item" role="menuitem" onClick={onOpen}>
      <span>{label}</span>
      <span className="xp-menu-value">
        <span>{value}</span> <ChevronRightIcon />
      </span>
    </button>
  )
}
