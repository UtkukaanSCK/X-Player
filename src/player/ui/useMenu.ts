import { useEffect, useRef, useState, type RefObject } from 'react'

interface Menu {
  open: boolean
  setOpen: (open: boolean) => void
  /** Put this on the element that wraps both the button and the popup. */
  wrapRef: RefObject<HTMLDivElement | null>
  /** Focus returns here when the menu closes with Escape. */
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
     * nothing is caught here.
     */
    const onFocusOut = (e: FocusEvent) => {
      if (e.relatedTarget !== null) return
      queueMicrotask(() => {
        if (dismissing || !wrap || wrap.contains(document.activeElement)) return
        const first = wrap.querySelector<HTMLElement>('[role="menuitem"], [role="menuitemradio"]')
        ;(first ?? buttonRef.current)?.focus()
      })
    }

    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('keydown', onKey, true)
    wrap?.addEventListener('focusout', onFocusOut)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('keydown', onKey, true)
      wrap?.removeEventListener('focusout', onFocusOut)
    }
  }, [open])

  return { open, setOpen, wrapRef, buttonRef }
}
