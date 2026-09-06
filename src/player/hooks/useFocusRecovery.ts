import { useEffect, type RefObject } from 'react'

/** A pointer press outside the player this recently explains the lost focus. */
const CLICKED_AWAY_MS = 400

/**
 * Keeps the keyboard alive when a control disappears from under it.
 *
 * Pressing the big play button starts playback, which removes the button, and
 * focus goes with it - to the document body, where none of the player's
 * shortcuts are listening. Every one of them was dead from that moment on for
 * anyone who started a video the obvious way, which is why the 5-second skip
 * looked unreliable rather than broken: click the picture and it worked, press
 * the play button and it did not.
 *
 * Focus falling to nothing has two causes and only one of them is this. The
 * other is the viewer clicking the page behind the player, and pulling focus
 * back then would be a bug of its own - it would take focus off whatever they
 * were reaching for and hand it to a video they had just clicked away from.
 * Two things separate them: whether the element that lost focus is still on
 * the page at all, and whether a press just landed outside.
 */
export function useFocusRecovery(containerRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let awayAt = 0
    const onPointerDown = (e: PointerEvent) => {
      const root = containerRef.current
      if (root && !root.contains(e.target as Node)) awayAt = performance.now()
    }

    const onFocusOut = (e: FocusEvent) => {
      // Focus that names its destination went somewhere on purpose.
      if (e.relatedTarget !== null) return
      const left = e.target as HTMLElement | null
      /*
       * The element is still in the document when this fires - React removes it
       * as part of the same commit - so the question of whether it survived can
       * only be answered after.
       */
      queueMicrotask(() => {
        if (!left || left.isConnected) return
        if (document.activeElement !== document.body) return
        if (performance.now() - awayAt < CLICKED_AWAY_MS) return
        containerRef.current?.focus({ preventScroll: true })
      })
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    el.addEventListener('focusout', onFocusOut)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      el.removeEventListener('focusout', onFocusOut)
    }
  }, [containerRef])
}
