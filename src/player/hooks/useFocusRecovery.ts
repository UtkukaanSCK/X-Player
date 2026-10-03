import { useEffect, type RefObject } from 'react'

/** A pointer press outside the player this recently explains the lost focus. */
const CLICKED_AWAY_MS = 400

/**
 * Whether the element that lost focus could take it back.
 *
 * Removal is the plain way a control stops being able to hold focus and it is
 * not the only one: a control the stylesheet hides is still in the document
 * and still cannot be focused. checkVisibility is the browser's own answer to
 * that, and `visibility` counts in it only when it is asked for, which is what
 * the visibilityProperty flag does. Opacity is deliberately not asked for: the
 * controls fade out with opacity and a control at opacity 0 can still be
 * focused, so fading is not leaving - and focusing one shows it again.
 *
 * Not every engine the player runs in has the method - Safari before 17.4 and
 * Firefox before 125 among them - and there the question stays the one it was,
 * whether the element is in the document at all. That leaves those engines the
 * behaviour they have today rather than a guess made on their behalf.
 */
function canStillHoldFocus(el: HTMLElement) {
  if (!el.isConnected) return false
  if (typeof el.checkVisibility !== 'function') return true
  return el.checkVisibility({ visibilityProperty: true })
}

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
 * Two things separate them: whether the element that lost focus could still
 * hold it, and whether a press just landed outside.
 *
 * Still on the page is not the same as still able to hold focus. From 300px
 * down the stylesheet hides the whole control bar while a resume offer is up,
 * so that no tap aims at a button the offer has to intercept to be answered;
 * the bar keeps its box, so every button in it stays in the document. A bar
 * button holding focus when the offer arrived was blurred by the browser and
 * read here as a move made on purpose, and focus stayed on the body - where,
 * the key listener being on the container rather than the document, Space
 * scrolled the host page instead of toggling play and the way back in was 43
 * Tab presses. Hidden counts as gone, and the answer is the same as for a
 * removed control: focus to the container, nothing further.
 *
 * Nothing is remembered between blurs, and nothing needs to be. The move is
 * made on the focusout alone, and a bar that comes back when the offer is
 * answered fires no focusout, so showing a control again moves nothing.
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
       * The element is still in the document when this fires - React removes
       * it, or hides what holds it, as part of the same commit - so the
       * question of whether it survived can only be answered after.
       */
      queueMicrotask(() => {
        if (!left || canStillHoldFocus(left)) return
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
