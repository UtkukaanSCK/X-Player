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
 * Scope is deliberately tiny. Only requests under <scope>/media/ are touched; every
 * other request on the site, including the page itself, passes through
 * untouched. Nothing is ever cached.
 */

/** 'normal' | 'slow3g' */
let mode = 'normal'

/**
 * Rates in bytes per second, per response.
 *
 * "Normal" is throttled too, and has to be. Served from localhost the whole
 * two-minute clip arrives in about a second, so both players would sit on the
 * entire file and nothing that happened to the connection afterwards could
 * possibly affect them - the demonstration would degrade into two videos
 * playing from memory. A real connection delivers a comfortable lead, not the
 * whole film at once, and 70 kB/s against the clip's 48 kB/s is exactly that.
 */
const RATES = {
  normal: 70 * 1024,
  slow3g: 16 * 1024,
}

/**
 * Every response is throttled to the same rate, independently.
 *
 * A single shared budget is a better model of one real connection, and it was
 * tried: it made the comparison unfair. The budget is first-come-first-served,
 * so whichever player happened to queue its chunks first took the pipe, and the
 * measurement came out 4.0 seconds to 0.0 - in our favour, which is the worst
 * possible way for a demonstration to be wrong.
 *
 * Giving each response the same rate is the controlled version: two players on
 * two identical bad links. Fairness matters more than realism here, because a
 * comparison that flatters the thing being sold proves nothing.
 *
 * A media element opens a few range requests at once, so the rate a player sees
 * is some multiple of this. What matters is that the multiple is the same for
 * both, and that the result is well under the 48 kB/s the clip needs.
 */
const CHUNK_BYTES = 4 * 1024

function reserve(bytes) {
  const rate = RATES[mode] ?? RATES.normal
  return new Promise((r) => setTimeout(r, (bytes / rate) * 1000))
}

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('message', (event) => {
  const data = event.data
  if (!data || data.type !== 'x-player-netsim') return

  if (data.mode === 'normal' || data.mode === 'slow3g') {
    mode = data.mode
  }
  // Answer on the port the page opened, so it can confirm the worker is live
  // and which mode actually took effect.
  event.ports?.[0]?.postMessage({ type: 'x-player-netsim-ack', mode })
})

/*
 * The path this worker was registered under, taken from its own registration
 * rather than written down.
 *
 * The scope is the site root on a domain of its own and /<repo>/ on GitHub
 * Pages, and a prefix hardcoded as '/media/' matches nothing in the second
 * case: every request passes through untouched and the comparison shows two
 * identical videos beside a caption insisting one of them is struggling. That
 * is the exact failure this whole page exists to make impossible, so the
 * prefix is derived instead of assumed.
 */
const SCOPE_PATH = new URL(self.registration.scope).pathname

function isSimulated(url) {
  return new URL(url).pathname.startsWith(`${SCOPE_PATH}media/`)
}

/**
 * Re-emits a response body at a fixed rate. Requires a readable body, which is
 * why the demo clip is served from this origin rather than a third-party host:
 * a cross-origin response without CORS is opaque and cannot be re-streamed.
 */
function throttle(response) {
  const reader = response.body.getReader()
  let carry = new Uint8Array(0)

  const stream = new ReadableStream({
    async pull(controller) {
      // Drain whatever is left over from the previous read first.
      if (carry.length > 0) {
        const piece = carry.subarray(0, CHUNK_BYTES)
        carry = carry.subarray(piece.length)
        await reserve(piece.length)
        controller.enqueue(piece)
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
      await reserve(piece.length)
      controller.enqueue(piece)
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
  if (!simulated) return

  event.respondWith(
    // Explicitly past the HTTP cache. A cached clip would be delivered without
    // touching the network, so the throttle would apply to nothing and the page
    // would sit there insisting it had slowed a connection down.
    fetch(request, { cache: 'no-store' }).then((response) => {
      if (!response.body) return response
      return throttle(response)
    }),
  )
})
