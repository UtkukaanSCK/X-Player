import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

/** Quiet for this long and the controls go away. */
const HIDE_AFTER_MS = 2500
/*
 * Longer for a finger, because a finger has no way to ask for more time. A
 * mouse renews the bar just by moving over the player, continuously and
 * without meaning to; touch has no hover, so the only way to keep the
 * controls is to tap again, and a tap is what the viewer is trying to spend
 * on a button. This number is a judgement, not a measurement.
 */
const HIDE_AFTER_TOUCH_MS = 4000
/** Close enough to the deadline that waiting again is not worth a timer. */
const SLACK_MS = 15

/**
 * Decides when the controls are visible.
 *
 * Rule: while paused, while a menu is open, while the pointer is over the
 * controls, or while keyboard focus is on one of them, the controls never hide.
 */
export function useControlsVisibility(
  containerRef: RefObject<HTMLElement | null>,
  playing: boolean,
  locked: boolean,
) {
  const [visible, setVisible] = useState(true)
  const now = useRef({ playing, locked })
  now.current = { playing, locked }

  /*
   * When the controls are due to go, rather than a timer per event.
   *
   * Moving a mouse across the player fires pointermove at the frame rate, and
   * each one used to tear down the pending timer and build another - sixty
   * timers a second to express one deadline. The deadline is now a number that
   * events write, and a single timer that reads it and waits again if it has
   * moved.
   */
  const dueAt = useRef(0)
  const timer = useRef<number | null>(null)
  const touch = useRef(false)

  const stop = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
    dueAt.current = 0
  }

  /*
   * The container carries tabIndex={0}, so clicking anything inside it that
   * cannot take focus lands focus on the container itself. Counting that as
   * "the keyboard is in here" would hold the bar open for the whole of an
   * ordinary click-to-play, so only a real control inside counts.
   */
  const focusInside = useCallback(() => {
    const el = containerRef.current
    const active = document.activeElement
    if (!el || !active || active === el || !el.contains(active)) return false
    /*
     * And it has to be focus someone is navigating with. Tapping a button
     * focuses it too, and on touch that focus never goes anywhere - so
     * holding the bar open for it held it open for good: tap mute on a phone
     * and the controls covered the video until you tapped elsewhere.
     * :focus-visible is the browser answering which kind of focus this is,
     * which is the same question and better answered there than here.
     */
    try {
      return active.matches(':focus-visible')
    } catch {
      // No support: keep the old answer, which errs towards staying open.
      return true
    }
  }, [containerRef])

  /*
   * The only way the controls ever go away.
   *
   * Guarding the pointer-leave path was not enough, because leaving is always
   * preceded by a pointermove, which re-arms the timer - so a control with
   * focus on it was hidden 2.5s later anyway, behind opacity 0 and
   * pointer-events: none, with no way back but the mouse. The guard has to sit
   * on the hide itself, which is the path that actually fires.
   */
  const hideNow = useCallback(() => {
    stop()
    if (focusInside()) return
    setVisible(false)
  }, [focusInside])

  const wake = useCallback(() => {
    timer.current = null
    if (!now.current.playing || now.current.locked) {
      dueAt.current = 0
      return
    }
    const left = dueAt.current - performance.now()
    if (left > SLACK_MS) {
      timer.current = window.setTimeout(wake, left)
      return
    }
    hideNow()
  }, [hideNow])

  const arm = useCallback(() => {
    if (!now.current.playing || now.current.locked) {
      stop()
      return
    }
    const wait = touch.current ? HIDE_AFTER_TOUCH_MS : HIDE_AFTER_MS
    dueAt.current = performance.now() + wait
    if (timer.current === null) timer.current = window.setTimeout(wake, wait)
  }, [wake])

  const show = useCallback(() => {
    setVisible(true)
    arm()
  }, [arm])

  useEffect(() => {
    if (!playing || locked) {
      stop()
      setVisible(true)
    } else {
      arm()
    }
  }, [playing, locked, arm])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onMove = (e: PointerEvent) => {
      touch.current = e.pointerType === 'touch'
      show()
    }
    /*
     * Lifting a finger fires pointerleave, because the pointer stops
     * existing - not because the viewer looked away. Hiding on it made the
     * bar appear on a tap and vanish two milliseconds later, which is what
     * "touching the player makes it close by itself" turned out to be. A
     * mouse or a pen leaving still means what it always meant.
     */
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      if (!now.current.locked && now.current.playing) hideNow()
    }
    const onFocusIn = () => {
      setVisible(true)
      /*
       * Only a real control holds the bar open. The container takes focus on
       * an ordinary click on the picture, and treating that as "the keyboard
       * is in here" left the controls up for good on a player someone had
       * simply clicked to play. Same distinction the hide path makes.
       */
      if (focusInside()) stop()
      else arm()
    }
    const onFocusOut = () => arm()

    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerdown', onMove)
    el.addEventListener('pointerleave', onLeave)
    el.addEventListener('focusin', onFocusIn)
    el.addEventListener('focusout', onFocusOut)
    return () => {
      stop()
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerdown', onMove)
      el.removeEventListener('pointerleave', onLeave)
      el.removeEventListener('focusin', onFocusIn)
      el.removeEventListener('focusout', onFocusOut)
    }
  }, [containerRef, show, arm, hideNow, focusInside])

  return { visible, show }
}
