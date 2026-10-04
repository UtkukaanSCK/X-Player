import { useEffect, useRef, useState, type RefObject } from 'react'

/** Every row a viewer can land on, in either menu. */
const ITEMS = '[role="menuitem"], [role="menuitemradio"]'

interface Menu {
  open: boolean
  setOpen: (open: boolean) => void
  /** Put this on the element that wraps both the button and the popup. */
  wrapRef: RefObject<HTMLDivElement | null>
  /** Focus returns here when the menu closes with Escape or Tab. */
  buttonRef: RefObject<HTMLButtonElement | null>
}

/**
 * Open/closed behaviour shared by the popups on the control bar.
 *
 * Escape is bound to the document rather than to the wrapper: choosing an option
 * unmounts the button that had focus, and a wrapper listener would never hear
 * the key again.
 */
export function useMenu(onOpenChange: (open: boolean) => void): Menu {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // The player keeps its controls up while any menu is open.
  useEffect(() => {
    onOpenChange(open)
  }, [open, onOpenChange])

  useEffect(() => {
    if (!open) return
    const wrap = wrapRef.current

    /*
     * Dismissing by clicking away also unmounts the focused item, and that
     * fires focusout with a null relatedTarget - the same shape as focus
     * falling out of a menu that is staying open. Without this flag the
     * fallback below would pull focus back onto the settings button at the very
     * moment the user clicked off it, which on an embedded player means taking
     * focus away from the page hosting it.
     */
    let dismissing = false

    const onDown = (e: PointerEvent) => {
      if (!wrap?.contains(e.target as Node)) {
        dismissing = true
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setOpen(false)
      buttonRef.current?.focus()
    }

    /*
     * Keep the keyboard inside the open menu.
     *
     * The same unmount that made Escape a document listener also drops focus:
     * choosing "Playback speed" removes the button being clicked, focus falls to
     * body, and the next Tab starts again from the top of the document instead of
     * from the menu. A deliberate Tab out names its destination, so only a fall to
     * nothing is caught here; onFocusIn closes the menu for those.
     */
    const onFocusOut = (e: FocusEvent) => {
      if (e.relatedTarget !== null) return
      queueMicrotask(() => {
        if (dismissing || !wrap || wrap.contains(document.activeElement)) return
        const first = wrap.querySelector<HTMLElement>(ITEMS)
        ;(first ?? buttonRef.current)?.focus()
      })
    }

    /*
     * Focus that lands outside the wrapper closes the menu and stays where it
     * went.
     *
     * Landing on an ancestor does not count: WebKit gives a clicked button no
     * focus and hands it to the player root, and pressing the menu's padding in
     * Chromium does the same, so closing there would end the menu before the
     * click lands. The root then holds focus with the menu open, and a Tab from
     * it goes to a bar control hidden under the menu; that is why this listens
     * for focusin, which sees the move, where the wrapper's focusout never does.
     * A keyboard move out of the wrapper lands on another control, never on the
     * root: the seek slider always precedes the menu buttons in tab order.
     * Bound on the wrapper's root node, not the document, so a player inside a
     * shadow root is not seen through its host. The cost is that focus moving
     * to the host page from inside such a root does not close the menu.
     */
    const onFocusIn = (e: Event) => {
      const to = e.target as Node
      if (!wrap?.contains(to) && !to.contains(wrap)) setOpen(false)
    }

    /*
     * The arrow keys move through the rows, the way a menu's do.
     *
     * They used to fall through to the player, so ArrowDown in an open menu
     * turned the volume down while focus stayed where it was. Up and Down step
     * and wrap, Home and End jump, and Left steps back out of a sub-panel.
     * From the button that opened the menu, Down and Up go in at either end.
     * Rows the bar is still showing are in the DOM but have no box, so they
     * are skipped. Bound on the wrapper, which the player's own listener sits
     * above, so a key handled here never reaches it.
     */
    const onNavigate = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return
      const menu = wrap?.querySelector<HTMLElement>('[role="menu"]')
      if (!menu) return
      const items = [...menu.querySelectorAll<HTMLElement>(ITEMS)].filter((el) => el.getClientRects().length > 0)
      if (items.length === 0) return
      const at = items.indexOf(document.activeElement as HTMLElement)
      let next: HTMLElement | undefined
      switch (e.key) {
        case 'ArrowDown':
          next = items[(at + 1) % items.length]
          break
        case 'ArrowUp':
          next = items[at <= 0 ? items.length - 1 : at - 1]
          break
        case 'Home':
          next = items[0]
          break
        case 'End':
          next = items[items.length - 1]
          break
        case 'Tab':
          // At any width. On a narrow player the open menu covers the bar, so
          // the next control in DOM order is hidden behind it. Tab from a row
          // closes the menu and hands focus to the button that opened it, the
          // way Escape does. With focus off the rows (on the button) Tab is
          // left alone: forward goes on into the first row, and Shift+Tab
          // leaves the wrapper, which onFocusIn closes the menu for.
          if (at < 0) return
          setOpen(false)
          buttonRef.current?.focus()
          e.preventDefault()
          e.stopPropagation()
          return
        case 'ArrowLeft': {
          // Choosing it unmounts the panel, and onFocusOut above puts focus
          // on the first row of the one that replaces it.
          const back = menu.querySelector<HTMLElement>('.xp-menu-back')
          if (!back) return
          back.click()
          break
        }
        default:
          return
      }
      e.preventDefault()
      e.stopPropagation()
      next?.focus()
    }

    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('keydown', onKey, true)
    const root = wrap?.getRootNode()
    root?.addEventListener('focusin', onFocusIn)
    wrap?.addEventListener('focusout', onFocusOut)
    wrap?.addEventListener('keydown', onNavigate)
    return () => {
      root?.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('keydown', onKey, true)
      wrap?.removeEventListener('focusout', onFocusOut)
      wrap?.removeEventListener('keydown', onNavigate)
    }
  }, [open])

  return { open, setOpen, wrapRef, buttonRef }
}
