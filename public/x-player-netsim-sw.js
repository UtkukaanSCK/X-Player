/*
 * Network simulator for the "see the difference" section.
 *
 * The page cannot throttle its own network, and DevTools throttling is not
 * something a visitor can be asked to do. So the comparison is driven by a
 * service worker that sits in front of the demo clip and can drop or slow the
 * bytes on command. Both players on the page are affected identically, which is
 * the whole point: nothing is staged, the raw <video> and X-Player are fed the
 * exact same degraded connection at the same moment.
 *
 * Scope is deliberately tiny. Only requests under /media/ are touched; every
 * other request on the site, including the page itself, passes through
 * untouched. Nothing is ever cached.
 */

/** 'normal' | 'slow3g' | 'offline' */
let mode = 'normal'

/**
 * Slow 2G territory. The demo clip runs at roughly 41 kB/s, so this is a little
 * under half of what playback needs - the buffer drains and the stall is real
 * rather than staged.
 */
const SLOW_BYTES_PER_SECOND = 16 * 1024
const CHUNK_BYTES = 4 * 1024

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('message', (event) => {
  const data = event.data
  if (!data || data.type !== 'x-player-netsim') return

  if (data.mode === 'normal' || data.mode === 'slow3g' || data.mode === 'offline') {
    mode = data.mode
  }
  // Answer on the port the page opened, so it can confirm the worker is live
  // and which mode actually took effect.
  event.ports?.[0]?.postMessage({ type: 'x-player-netsim-ack', mode })
})

function isSimulated(url) {
  return new URL(url).pathname.startsWith('/media/')
}

/**
 * Re-emits a response body at a fixed rate. Requires a readable body, which is
 * why the demo clip is served from this origin rather than a third-party host:
 * a cross-origin response without CORS is opaque and cannot be re-streamed.
 */
function throttle(response) {
  const reader = response.body.getReader()
  const msPerChunk = (CHUNK_BYTES / SLOW_BYTES_PER_SECOND) * 1000
  let carry = new Uint8Array(0)

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

  const stream = new ReadableStream({
    async pull(controller) {
      // Drain whatever is left over from the previous read first.
      if (carry.length > 0) {
        const piece = carry.subarray(0, CHUNK_BYTES)
        carry = carry.subarray(piece.length)
        controller.enqueue(piece)
        await sleep(msPerChunk)
        return
      }

      const { done, value } = await reader.read()
      if (done) {
        controller.close()
        return
      }

      carry = value
      const piece = carry.subarray(0, CHUNK_BYTES)
      carry = carry.subarray(piece.length)
      controller.enqueue(piece)
      await sleep(msPerChunk)
    },
    cancel(reason) {
      return reader.cancel(reason)
    },
  })

  // Preserve status and headers so byte-range requests keep working; a media
  // element depends on 206 + Content-Range to seek.
  return new Response(stream, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  let simulated = false
  try {
    simulated = isSimulated(request.url)
  } catch {
    return
  }
  if (!simulated || mode === 'normal') return

  if (mode === 'offline') {
    // A network-level failure, the same thing the browser reports when the
    // connection drops mid-playback.
    event.respondWith(Response.error())
    return
  }

  event.respondWith(
    fetch(request).then((response) => {
      if (!response.body) return response
      return throttle(response)
    }),
  )
})
