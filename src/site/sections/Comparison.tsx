import { useCallback, useEffect, useRef, useState } from 'react'
import { XPlayer } from '../../player/XPlayer'
import { DEMO_POSTER, DEMO_SOURCES, DEMO_TRACKS } from '../config'
import { useNetworkSim, type NetworkMode } from '../hooks/useNetworkSim'

interface Reading {
  state: string
  time: number
  buffered: number
  error: string | null
}

const EMPTY: Reading = { state: 'idle', time: 0, buffered: 0, error: null }

const MODES: { id: NetworkMode; label: string; hint: string }[] = [
  { id: 'normal', label: 'Normal', hint: 'Full speed' },
  { id: 'slow3g', label: 'Slow 2G', hint: '~16 kB/s' },
  { id: 'offline', label: 'Offline', hint: 'Connection dropped' },
]

const ERROR_NAMES: Record<number, string> = {
  1: 'ABORTED',
  2: 'NETWORK',
  3: 'DECODE',
  4: 'SRC_NOT_SUPPORTED',
}

/** Polls a video element for the numbers a viewer would otherwise have to guess at. */
function useReading(getVideo: () => HTMLVideoElement | null): Reading {
  const [reading, setReading] = useState<Reading>(EMPTY)

  useEffect(() => {
    const id = window.setInterval(() => {
      const v = getVideo()
      if (!v) {
        setReading(EMPTY)
        return
      }
      const buffered = v.buffered.length ? v.buffered.end(v.buffered.length - 1) - v.currentTime : 0
      let state = 'paused'
      if (v.error) state = 'error'
      else if (v.ended) state = 'ended'
      else if (!v.paused && v.readyState < 3) state = 'stalled'
      else if (!v.paused) state = 'playing'

      setReading({
        state,
        time: v.currentTime,
        buffered: Math.max(0, buffered),
        error: v.error ? (ERROR_NAMES[v.error.code] ?? `code ${v.error.code}`) : null,
      })
    }, 350)
    return () => window.clearInterval(id)
  }, [getVideo])

  return reading
}

function Readout({ reading }: { reading: Reading }) {
  return (
    <dl className="readout">
      <div>
        <dt>State</dt>
        <dd data-state={reading.state}>{reading.error ?? reading.state}</dd>
      </div>
      <div>
        <dt>Position</dt>
        <dd>{reading.time.toFixed(1)}s</dd>
      </div>
      <div>
        <dt>Buffer ahead</dt>
        <dd>{reading.buffered.toFixed(1)}s</dd>
      </div>
    </dl>
  )
}

/**
 * The centrepiece: the same clip in a bare <video> and in X-Player, fed by the
 * same simulated connection at the same instant.
 *
 * Switching mode remounts both players so each one re-opens the connection under
 * the new conditions. That is deliberate and it is what the label says: a clip
 * this short buffers completely in well under a second, so without a fresh fetch
 * nothing would be demonstrated at all - the video would simply play on from
 * memory. Re-opening reproduces the case that actually bites in the real world:
 * reaching for a part of a long video the browser has not downloaded yet, on a
 * connection that has gone bad.
 */
export function Comparison() {
  const { mode, status, setMode } = useNetworkSim()
  const [runId, setRunId] = useState(0)
  const plainRef = useRef<HTMLVideoElement>(null)
  const playerWrapRef = useRef<HTMLDivElement>(null)

  const getPlain = useCallback(() => plainRef.current, [])
  const getPlayer = useCallback(() => playerWrapRef.current?.querySelector('video') ?? null, [])
  const plainReading = useReading(getPlain)
  const playerReading = useReading(getPlayer)

  const changeMode = (next: NetworkMode) => {
    setMode(next)
    // Remount both sides so they reconnect under the new conditions.
    setRunId((n) => n + 1)
  }

  const playBoth = useCallback(() => {
    void plainRef.current?.play().catch(() => {})
    void getPlayer()?.play().catch(() => {})
  }, [getPlayer])

  // After a remount, ask both sides to play again.
  //
  // A single delayed call is not reliable here: on a starved link the fresh
  // elements have no data yet and the request can be rejected outright. Retry a
  // few times, and stop as soon as both are actually running.
  useEffect(() => {
    if (runId === 0) return
    let attempts = 0
    const id = window.setInterval(() => {
      attempts += 1
      const plain = plainRef.current
      const player = getPlayer()
      if (attempts > 8 || (plain && player && !plain.paused && !player.paused)) {
        window.clearInterval(id)
        return
      }
      playBoth()
    }, 400)
    return () => window.clearInterval(id)
  }, [runId, playBoth, getPlayer])

  const ready = status.kind === 'ready'

  // A remount alone is not enough to re-open the connection: the browser keeps
  // the clip in its media cache and serves it back without ever issuing a
  // request, so the service worker never sees it. A per-run query string makes
  // each attempt a genuinely new fetch. Same file, same bytes - just not from
  // memory.
  const bust = runId === 0 ? '' : `?run=${runId}`
  // Both sides get the same rendition, so the only difference on screen is the
  // player itself.
  const clip = DEMO_SOURCES[0].src + bust

  return (
    <section className="scene" data-scene="compare" id="compare">
      <div>
        <header className="scene-head">
          <p className="marker">See the difference</p>
          <h2>Break the network and watch both.</h2>
          <p className="lede">
            Same clip, same moment, same connection. On the left, the browser&rsquo;s built-in player. On the
            right, X-Player. On a merely slow link the two cope about equally well &mdash; both stutter and
            catch up. Press <strong>Offline</strong>: that is where they part company.
          </p>
        </header>

        <div className="sim-controls" role="group" aria-label="Simulated network condition">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`sim-btn${mode === m.id ? ' is-active' : ''}`}
              onClick={() => changeMode(m.id)}
              disabled={!ready}
              aria-pressed={mode === m.id}
            >
              <strong>{m.label}</strong>
              <span>{m.hint}</span>
            </button>
          ))}
          <button type="button" className="sim-play" onClick={playBoth} disabled={!ready}>
            Play both
          </button>
        </div>

        <p className="sim-explainer">
          A service worker on this page shapes the bytes for both players equally &mdash; nothing here is
          staged. Switching condition reconnects both from scratch, because a 14-second clip buffers
          completely in under a second and there would otherwise be nothing to see.
        </p>

        {status.kind === 'unavailable' && (
          <p className="sim-warning" role="status">
            The live comparison needs a service worker to shape the connection, and it could not start here:{' '}
            {status.reason} Everything else on this page still works.
          </p>
        )}
        {status.kind === 'pending' && (
          <p className="sim-warning is-quiet" role="status">
            Starting the network simulator&hellip;
          </p>
        )}

        <div className="compare-grid">
          <article className="compare-side">
            <h3>
              Plain <code>&lt;video controls&gt;</code>
            </h3>
            <div className="compare-frame">
              <video
                key={`plain-${runId}`}
                ref={plainRef}
                controls
                playsInline
                preload="auto"
                poster={DEMO_POSTER}
                className="plain-video"
              >
                <source src={clip} type="video/mp4" />
              </video>
            </div>
            <Readout reading={plainReading} />
            <p className="compare-note">
              Buffers and stutters through a slow link perfectly well. But when the connection actually goes,
              it stops on a broken element: no retry, no explanation, and reloading loses your place. It also
              cannot play HLS at all outside Safari.
            </p>
          </article>

          <article className="compare-side is-featured">
            <h3>X-Player</h3>
            <div className="compare-frame" ref={playerWrapRef}>
              <XPlayer
                key={`player-${runId}`}
                src={clip}
                poster={DEMO_POSTER}
                tracks={DEMO_TRACKS}
                rememberPosition={false}
                accent="#FFB020"
              />
            </div>
            <Readout reading={playerReading} />
            <p className="compare-note">
              Handles the slow link the same way, then keeps going where the other stops: a stall guard
              retries in the background with a growing delay, and if the connection really is gone it says so
              in plain language and offers a Try again button that resumes from the same spot.
            </p>
          </article>
        </div>
      </div>
    </section>
  )
}
