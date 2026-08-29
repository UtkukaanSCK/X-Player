import { useCallback, useEffect, useRef, useState } from 'react'

export interface Chapter {
  id: string
  label: string
}

/**
 * Formats a scroll fraction as a timecode. The page has a "runtime"; where you
 * are in it is a position in that runtime. Frames are at 25 fps because the
 * number has to come from somewhere and a frame count reads as real timecode
 * rather than as decoration.
 */
function timecode(seconds: number): string {
  const total = Math.max(0, seconds)
  const m = Math.floor(total / 60)
  const s = Math.floor(total % 60)
  const f = Math.floor((total % 1) * 25)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(m)}:${pad(s)}:${pad(f)}`
}

/** Treat the page as a reel of this many seconds. */
const RUNTIME_SECONDS = 210

interface Props {
  chapters: Chapter[]
}

/**
 * A timeline down the left edge of the page: the scroll position is a playhead,
 * each section is a chapter marker, and clicking a marker scrolls to it.
 *
 * This replaces the usual row of nav links. The page is about a video player, so
 * its navigation is the one control every viewer already knows how to read.
 */
export function PlayheadRail({ chapters }: Props) {
  const [progress, setProgress] = useState(0)
  const [marks, setMarks] = useState<{ id: string; label: string; at: number }[]>([])
  const [active, setActive] = useState(0)
  const frameRef = useRef(0)

  const measure = useCallback(() => {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight
    if (scrollable <= 0) {
      setMarks(chapters.map((c) => ({ ...c, at: 0 })))
      return
    }
    setMarks(
      chapters.map((c) => {
        const el = document.getElementById(c.id)
        const top = el ? el.getBoundingClientRect().top + window.scrollY : 0
        return { ...c, at: Math.min(1, Math.max(0, top / scrollable)) }
      }),
    )
  }, [chapters])

  useEffect(() => {
    const onScroll = () => {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = requestAnimationFrame(() => {
        const scrollable = document.documentElement.scrollHeight - window.innerHeight
        const p = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0
        setProgress(p)
      })
    }

    measure()
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', measure)
    // Late-loading media and fonts change the page height, and every mark is a
    // fraction of that height.
    window.addEventListener('load', measure)
    const settle = window.setTimeout(measure, 1200)
    return () => {
      cancelAnimationFrame(frameRef.current)
      window.clearTimeout(settle)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', measure)
      window.removeEventListener('load', measure)
    }
  }, [measure])

  // Which chapter are we in? The last one whose start we have passed.
  useEffect(() => {
    if (marks.length === 0) return
    let i = 0
    for (let k = 0; k < marks.length; k++) {
      if (progress + 0.02 >= marks[k].at) i = k
    }
    setActive(i)
  }, [progress, marks])

  const goTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
      {/* Below the rail's breakpoint the position still has to be visible. */}
      <div className="rail-progress" style={{ width: `${progress * 100}%` }} aria-hidden="true" />
      <nav className="rail" aria-label="Sections">
      <div className="rail-track" aria-hidden="true">
        <div className="rail-fill" style={{ transform: `scaleY(${progress})` }} />
        <div className="rail-head" style={{ top: `${progress * 100}%` }}>
          <span className="rail-time">{timecode(progress * RUNTIME_SECONDS)}</span>
        </div>
      </div>

      <ol className="rail-marks">
        {marks.map((m, i) => (
          <li key={m.id} style={{ top: `${m.at * 100}%` }}>
            <button
              type="button"
              className={`rail-mark${i === active ? ' is-active' : ''}`}
              onClick={() => goTo(m.id)}
              aria-current={i === active ? 'true' : undefined}
            >
              <span className="rail-dot" aria-hidden="true" />
              <span className="rail-label">{m.label}</span>
            </button>
          </li>
        ))}
        </ol>
      </nav>
    </>
  )
}
