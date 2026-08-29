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

    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setOpen(false)
      buttonRef.current?.focus()
    }

    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  return { open, setOpen, wrapRef, buttonRef }
}
