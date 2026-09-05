'use client'

import { useState } from 'react'

/** What Chromium exposes; absent in Safari and Firefox, hence every guard. */
interface Connection {
  saveData?: boolean
  effectiveType?: string
}

const SLOW = new Set(['slow-2g', '2g', '3g'])

/**
 * Whether this visitor's connection has asked to be spent carefully.
 *
 * The comparison is two players streaming the same two-minute clip, so it costs
 * about twelve megabytes - the demonstration cannot be made cheap without
 * making it dishonest, because a clip small enough to be cheap is also small
 * enough that throttling it proves nothing. What can be done is to stop
 * spending someone's data without asking.
 *
 * The signal is the browser's, not a guess from screen size: a phone on wifi
 * should get the demonstration immediately, and a laptop tethered to a phone
 * should not. `saveData` is the visitor saying so outright; a 2G or 3G
 * effectiveType is the browser saying it for them.
 *
 * Read once, in a lazy initialiser rather than an effect: this component is
 * client-only, so navigator exists at first render, and deciding later would
 * mean starting the download and then wishing we had not.
 */
export function useFrugalConnection(): boolean {
  const [frugal] = useState(() => {
    if (typeof navigator === 'undefined') return false
    const connection = (navigator as Navigator & { connection?: Connection }).connection
    if (!connection) return false
    return connection.saveData === true || SLOW.has(connection.effectiveType ?? '')
  })
  return frugal
}
