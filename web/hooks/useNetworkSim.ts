"use client"

import { useCallback, useEffect, useRef, useState } from 'react'

import { BASE_PATH, withBase } from '@/lib/site'

export type NetworkMode = 'normal' | 'slow3g'

const SW_URL = withBase('/x-player-netsim-sw.js')
/*
 * A worker may only claim a scope at or below its own path, so a site served
 * from /X-Player/ cannot register one for '/'. Asking for the root there fails
 * the registration outright and the comparison silently has nothing driving it.
 */
const SW_SCOPE = `${BASE_PATH}/`

export type SimStatus =
  | { kind: 'pending' }
  | { kind: 'ready' }
  | { kind: 'unavailable'; reason: string }

/**
 * Registers the network simulator service worker and switches its mode.
 *
 * The comparison section needs to degrade the connection for real, so both
 * players see the same thing at the same moment. When that is not possible -
 * no service worker support, an insecure context, a failed registration - the
 * hook reports why, and the section disables its controls rather than showing
 * a demonstration that is quietly fake.
 */
export function useNetworkSim() {
  const [mode, setMode] = useState<NetworkMode>('normal')
  const [status, setStatus] = useState<SimStatus>({ kind: 'pending' })
  const workerRef = useRef<ServiceWorker | null>(null)

  useEffect(() => {
    let cancelled = false

    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      setStatus({ kind: 'unavailable', reason: 'This browser has no service worker support.' })
      return
    }
    if (!window.isSecureContext) {
      setStatus({ kind: 'unavailable', reason: 'Service workers need HTTPS or localhost.' })
      return
    }

    navigator.serviceWorker
      .register(SW_URL, { scope: SW_SCOPE })
      .then(async (registration) => {
        // `controller` is what actually intercepts requests; a freshly installed
        // worker only becomes the controller after it claims the page.
        await navigator.serviceWorker.ready
        const worker = navigator.serviceWorker.controller ?? registration.active
        if (cancelled) return
        if (!worker) {
          setStatus({ kind: 'unavailable', reason: 'The simulator did not take control of this page. Reload to retry.' })
          return
        }
        workerRef.current = worker
        // A service worker outlives the page that installed it, and so does its
        // mode. Without this, reloading while the link was throttled leaves the
        // throttle in place, and the page arrives already crawling for reasons
        // the visitor has no way to guess at.
        worker.postMessage({ type: 'x-player-netsim', mode: 'normal' })
        setStatus({ kind: 'ready' })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setStatus({
          kind: 'unavailable',
          reason: err instanceof Error ? err.message : 'The simulator could not be started.',
        })
      })

    return () => {
      cancelled = true
    }
  }, [])

  const apply = useCallback((next: NetworkMode) => {
    const worker = workerRef.current ?? navigator.serviceWorker?.controller
    if (!worker) return
    // A MessageChannel gives the worker a way to confirm the mode it applied,
    // so the UI never claims a state the worker is not actually in.
    const channel = new MessageChannel()
    channel.port1.onmessage = (event) => {
      const data = event.data
      if (data?.type === 'x-player-netsim-ack') setMode(data.mode as NetworkMode)
    }
    worker.postMessage({ type: 'x-player-netsim', mode: next }, [channel.port2])
    setMode(next)
  }, [])

  // Never leave a page-wide throttle behind when the visitor scrolls away.
  useEffect(() => {
    const reset = () => {
      const worker = workerRef.current ?? navigator.serviceWorker?.controller
      worker?.postMessage({ type: 'x-player-netsim', mode: 'normal' })
    }
    window.addEventListener('pagehide', reset)
    return () => {
      reset()
      window.removeEventListener('pagehide', reset)
    }
  }, [])

  return { mode, status, setMode: apply }
}
