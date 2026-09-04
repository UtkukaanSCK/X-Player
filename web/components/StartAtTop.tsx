'use client'

import { useEffect } from 'react'

/**
 * Reloading starts the page again from the top.
 *
 * Browsers restore the scroll position on reload, which is right for an article
 * and wrong here: this page's first section is a demonstration that runs as you
 * scroll through it, so being dropped back into the middle of one means arriving
 * at an ending with no beginning. Pressing F5 should mean starting over.
 *
 * `scrollRestoration` is set before the first paint so the browser never gets
 * the chance to jump; the explicit scroll covers the case where it already has.
 */
export function StartAtTop() {
  useEffect(() => {
    const previous = history.scrollRestoration
    try {
      history.scrollRestoration = 'manual'
    } catch {
      /* not supported; the scroll below still puts things right */
    }
    window.scrollTo(0, 0)

    return () => {
      try {
        history.scrollRestoration = previous
      } catch {
        /* nothing to restore */
      }
    }
  }, [])

  return null
}
