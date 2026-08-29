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

  const schedule = useCallback(() => {
    clear()
    if (!playingRef.current || lockedRef.current) return
    timerRef.current = window.setTimeout(() => setVisible(false), HIDE_AFTER_MS)
  }, [])

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
      if (!lockedRef.current && playingRef.current) {
        clear()
        setVisible(false)
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
  }, [containerRef, show, schedule])

  return { visible, show }
}
