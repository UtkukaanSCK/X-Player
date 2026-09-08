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
 * whole film at once, and 34 kB/s against the clip's 24 kB/s is exactly that.
 */
const RATES = {
  normal: 34 * 1024,
  slow3g: 8 * 1024,
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
 * both, and that the result is well under the 24 kB/s the clip needs.
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

  /*
   * Rebuilt from the URL rather than forwarded as-is, carrying the original
   * headers across by hand.
   *
   * A media element's request is mode: 'no-cors', and re-creating one with any
   * init at all puts its headers behind the no-cors guard, which drops Range -
   * that header is CORS-safelisted but not no-CORS-safelisted. The whole file
   * then comes back 200 where a 206 was asked for, so every seek re-downloads
   * from byte zero. Measured against this worker: a seek to 90s asked for
   * bytes=2293760- and was sent all 3,006,827 bytes - 2.3 MB of already-played
   * video arriving before a single frame anyone was waiting for. Same page,
   * same server, only this call changed: 71.3 seconds of frozen player
   * before, 2.1 after.
   *
   * One trade is worth naming before someone measures it and calls it a
   * regression: under the old call the second and third seeks cost 0.3s, and
   * now they cost 2 to 3. That speed was bought by the first seek having
   * already dragged the entire clip down, which is both the 71 second freeze
   * and the thing this page warns about elsewhere - a player holding the whole
   * file is a player no throttle setting can touch.
   *
   *   fetch(request, { cache: 'no-store' })              -> 200, no Content-Range
   *   fetch(new Request(request, { cache: 'no-store' })) -> 200, no Content-Range
   *   fetch(request)                                     -> 206, correct range
   *   fetch(url, { cache: 'no-store', headers })         -> 206, correct range
   *
   * The last is what runs: a fresh request is not under a no-cors guard, so the
   * headers survive and 'no-store' can be kept. Dropping the init would also
   * restore seeking, but the HTTP cache would then be free to answer, and a
   * cached clip is delivered without touching the network - the throttle would
   * apply to nothing and the page would sit there insisting it had slowed a
   * connection down.
   *
   * The whole header list is copied rather than Range alone, so nothing else
   * the element sent is quietly dropped. And copied rather than written: setting
   * Range unconditionally would turn the one request that legitimately carries
   * none - a plain load - into a range request, answered 206 where it should be
   * 200. Measured all three shapes: no Range in, none out, 200 and the whole
   * file; bytes=0- and bytes=2293760- both answered 206 with the right range.
   *
   * The rate was exonerated on the way, which is worth writing down because the
   * obvious next idea is to stop throttling Normal. The throttle was left
   * exactly as it is and the seek still went from 71.3s to 2.1s, so the headroom
   * between 34 kB/s and the clip's 24 was never the binding constraint. Removing
   * it would cost the section the stated rate it is built on and fix nothing.
   */
  event.respondWith(
    fetch(request.url, { cache: 'no-store', headers: request.headers }).then((response) => {
      if (!response.body) return response
      return throttle(response)
    }),
  )
})
