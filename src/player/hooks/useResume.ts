import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

const PREFIX = 'xp:pos:'
/** Past this ratio the video counts as finished; no resume offer. */
const DONE_RATIO = 0.95
/** Shorter than this is not worth remembering. */
const MIN_SECONDS = 15

function keyFor(key: string) {
  // blob: URLs change on every reload, so they cannot be remembered.
  if (key.startsWith('blob:')) return null
  return PREFIX + key
}

/**
 * Persists the playback position and offers to resume on the next visit.
 * It never seeks on its own: nothing moves until the viewer accepts.
 */
export function useResume(
  videoRef: RefObject<HTMLVideoElement | null>,
  src: string,
  enabled: boolean,
  storageKey?: string,
) {
  const [offer, setOffer] = useState<number | null>(null)
  const keyRef = useRef<string | null>(null)
  keyRef.current = enabled ? keyFor(storageKey ?? src) : null

  const read = useCallback((): number => {
    const k = keyRef.current
    if (!k) return 0
    try {
      const raw = window.localStorage.getItem(k)
      const value = raw ? Number(raw) : 0
      return Number.isFinite(value) && value > 0 ? value : 0
    } catch {
      return 0
    }
  }, [])

  const write = useCallback((seconds: number) => {
    const k = keyRef.current
    if (!k) return
    try {
      if (seconds <= 0) window.localStorage.removeItem(k)
      else window.localStorage.setItem(k, String(Math.floor(seconds)))
    } catch {
      /* private window or full storage - ignore quietly */
    }
  }, [])

  useEffect(() => {
    setOffer(null)
  }, [src])

  /*
   * The last video a position was offered for - only the last, not every one
   * seen on this mount. Switching quality
   * re-attaches the element and fires loadedmetadata again under the same
   * video, and a second offer would arrive for a position the viewer has
   * answered already or has long since played past - pinning the controls
   * until it is answered again. It is set only when an offer is really made,
   * so a first load whose metadata arrives late still gets to make one.
   */
  const offeredFor = useRef<string | null>(null)

  // Work out the offer once metadata arrives.
  useEffect(() => {
    const video = videoRef.current
    if (!video || !enabled) return
    const onMeta = () => {
      if (offeredFor.current === src) return
      const saved = read()
      // Same guard the save path uses: a live stream reports Infinity, which is
      // truthy, so a position left by an earlier build would still be offered.
      if (
        saved > MIN_SECONDS &&
        Number.isFinite(video.duration) &&
        saved < video.duration * DONE_RATIO
      ) {
        offeredFor.current = src
        setOffer(saved)
      }
    }
    if (video.readyState >= 1) onMeta()
    video.addEventListener('loadedmetadata', onMeta)
    return () => video.removeEventListener('loadedmetadata', onMeta)
  }, [videoRef, enabled, src, read])

  // Save the position on an interval, not on every frame.
  useEffect(() => {
    if (!enabled) return
    const save = () => {
      const video = videoRef.current
      if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return
      if (video.currentTime >= video.duration * DONE_RATIO) write(0)
      else if (video.currentTime > MIN_SECONDS) write(video.currentTime)
    }
    /*
     * The interval skips a paused video - there is nothing new to record - but
     * the two saves that matter most happen exactly when it is paused: leaving
     * the page, and unmounting. Guarding inside save() defeated both, so
     * pausing, seeking and closing lost the seek and resumed from the last tick
     * that happened while playing.
     */
    const tick = () => {
      const video = videoRef.current
      if (video && !video.paused) save()
    }
    /*
     * pagehide covers navigating away, but a phone that backgrounds the tab and
     * then has it reclaimed by the OS never fires it - and that is exactly where
     * playback is most likely to be interrupted mid-video.
     */
    const onHidden = () => {
      if (document.visibilityState === 'hidden') save()
    }
    const id = window.setInterval(tick, 4000)
    window.addEventListener('pagehide', save)
    document.addEventListener('visibilitychange', onHidden)
    return () => {
      save()
      window.clearInterval(id)
      window.removeEventListener('pagehide', save)
      document.removeEventListener('visibilitychange', onHidden)
    }
  }, [videoRef, enabled, write])

  const acceptOffer = useCallback(() => {
    const video = videoRef.current
    if (video && offer !== null) video.currentTime = offer
    setOffer(null)
  }, [videoRef, offer])

  /*
   * Takes the card off the screen and leaves the stored position where it is.
   * No press erases a position: measured at a 300px-wide player with a coarse
   * pointer, the card is 84px tall against a 46px bar and covers it entirely,
   * so a tap meant for settings or full screen lands on the card's own button,
   * and a bookmark lost to a mis-aimed tap is worse than the price of keeping
   * one too long.
   *
   * That price, weighed and accepted: a viewer who answers Start over and
   * leaves within MIN_SECONDS is offered the same position again next time.
   * Playing on overwrites it at the first save tick after MIN_SECONDS, and if
   * the viewer does reach DONE_RATIO the save path removes the key outright.
   * Leaving anywhere in between leaves that position as the bookmark.
   *
   * The label stays honest all the same. The card asks whether to resume, so
   * the second button means "no, I will watch from the beginning", and a fresh
   * load is already at 0, leaving it nothing to do. "Not now" would be worse:
   * the offer does not return this session, so it would promise what is untrue.
   */
  const closeOffer = useCallback(() => {
    setOffer(null)
  }, [])

  return { offer, acceptOffer, closeOffer }
}
