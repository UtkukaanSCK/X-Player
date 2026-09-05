import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

const HIDE_AFTER_MS = 2500

/**
 * Decides when the controls are visible.
 * Rule: while paused, while the pointer is over the controls, while a menu is
 * open, or while keyboard focus is inside, the controls NEVER hide.
 */
export function useControlsVisibility(
  containerRef: RefObject<HTMLElement | null>,
  playing: boolean,
  locked: boolean,
) {
  const [visible, setVisible] = useState(true)
  const timerRef = useRef<number | null>(null)
  const lockedRef = useRef(locked)
  lockedRef.current = locked
  const playingRef = useRef(playing)
  playingRef.current = playing

  const clear = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  /*
   * The container carries tabIndex={0}, so clicking anything inside it that
   * cannot take focus lands focus on the container itself. Counting that as
   * "the keyboard is in here" would hold the bar open for the whole of an
   * ordinary click-to-play, so only a real control inside counts.
   */
  const keyboardInside = useCallback(() => {
    const el = containerRef.current
    const active = document.activeElement
    return !!el && !!active && active !== el && el.contains(active)
  }, [containerRef])

  /*
   * Every path that hides goes through here, because guarding only the
   * pointer-leave path missed the one that actually fires: leaving is always
   * preceded by a pointermove, which re-arms this timer, so a focused control
   * was hidden 2.5s later anyway.
   */
  const hide = useCallback(() => {
    if (keyboardInside()) return
    setVisible(false)
  }, [keyboardInside])

  const schedule = useCallback(() => {
    clear()
    if (!playingRef.current || lockedRef.current) return
    timerRef.current = window.setTimeout(hide, HIDE_AFTER_MS)
  }, [hide])

  const show = useCallback(() => {
    setVisible(true)
    schedule()
  }, [schedule])

  useEffect(() => {
    if (!playing || locked) {
      clear()
      setVisible(true)
    } else {
      schedule()
    }
  }, [playing, locked, schedule])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onMove = () => show()
    const onLeave = () => {
      // Tabbing to a control and then moving the mouse off the window used to
      // fade the bar to opacity 0 and pointer-events: none with the focus still
      // sitting on it - invisible, unreachable, and no way back but the mouse.
      // hide() is what refuses to do that now.
      if (!lockedRef.current && playingRef.current) {
        clear()
        hide()
      }
    }
    const onFocusIn = () => {
      setVisible(true)
      clear()
    }
    const onFocusOut = () => schedule()

    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerdown', onMove)
    el.addEventListener('pointerleave', onLeave)
    el.addEventListener('focusin', onFocusIn)
    el.addEventListener('focusout', onFocusOut)
    return () => {
      clear()
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerdown', onMove)
      el.removeEventListener('pointerleave', onLeave)
      el.removeEventListener('focusin', onFocusIn)
      el.removeEventListener('focusout', onFocusOut)
    }
  }, [containerRef, show, schedule, hide])

  return { visible, show }
}
