import { StrictMode, useCallback, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { XPlayer } from '../player/XPlayer'
import type { XPlayerSource, XPlayerTrack } from '../player/types'
import './dev.css'

/**
 * Development harness.
 *
 * Not a demo site: this page exists so the player can be run and driven while
 * working on it, and so the end-to-end suites have something stable to drive.
 * Each block is one case worth checking by hand. The landing site is a separate
 * project and is not part of this repository.
 */

const SOURCES: XPlayerSource[] = [
  { src: '/media/demo-480p.mp4', label: '480p' },
  { src: '/media/demo-360p.mp4', label: '360p' },
  { src: '/media/demo-240p.mp4', label: '240p' },
]

const TRACKS: XPlayerTrack[] = [
  { src: '/media/demo-en.vtt', label: 'English', srclang: 'en' },
  { src: '/media/demo-tr.vtt', label: 'Türkçe', srclang: 'tr' },
]

const POSTER = '/media/demo.jpg'
const HLS = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'

function Case({ id, title, note, children }: { id: string; title: string; note: string; children: React.ReactNode }) {
  return (
    <section className="case" id={id}>
      <h2>{title}</h2>
      <p>{note}</p>
      {children}
    </section>
  )
}

function Harness() {
  const [urlInput, setUrlInput] = useState('')
  const [custom, setCustom] = useState<{ src: string; title: string } | null>(null)
  const [dragging, setDragging] = useState(false)
  const objectUrlRef = useRef<string | null>(null)

  const playLocalFile = useCallback((file: File) => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    const url = URL.createObjectURL(file)
    objectUrlRef.current = url
    setCustom({ src: url, title: file.name })
  }, [])

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    },
    [],
  )

  useEffect(() => {
    let depth = 0
    const hasFile = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')
    const onEnter = (e: DragEvent) => {
      if (!hasFile(e)) return
      depth += 1
      setDragging(true)
    }
    const onOver = (e: DragEvent) => {
      if (hasFile(e)) e.preventDefault()
    }
    const onLeave = () => {
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    const onDrop = (e: DragEvent) => {
      if (!hasFile(e)) return
      e.preventDefault()
      depth = 0
      setDragging(false)
      const file = Array.from(e.dataTransfer?.files ?? []).find((f) => f.type.startsWith('video/'))
      if (file) playLocalFile(file)
    }
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragover', onOver)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [playLocalFile])

  return (
    <div className="wrap">
      {dragging && <div className="drop">Drop a video to play it</div>}

      <h1>X-Player development harness</h1>
      <p className="sub">
        Every case below is one thing worth checking by hand. <code>npm run e2e</code> drives this page too.
      </p>

      <Case
        id="ladder"
        title="Progressive quality ladder"
        note="Three encodes of one file. The quality button on the bar should list all three, switch without losing your place, and keep the subtitle selection."
      >
        <div className="stage" data-case="ladder">
          <XPlayer sources={SOURCES} poster={POSTER} tracks={TRACKS} title="Sintel (excerpt)" rememberPosition={false} />
        </div>
      </Case>

      <Case
        id="hls"
        title="HLS stream"
        note="Adaptive renditions declared by the stream. The same quality button should show what is playing plus an 'auto' badge."
      >
        <div className="stage" data-case="hls">
          <XPlayer src={HLS} title="Tears of Steel" rememberPosition={false} />
        </div>
      </Case>

      <Case
        id="single"
        title="Single file"
        note="Nothing to choose between, so the quality button must not appear at all. Resume is on here, so reloading should offer to pick up where you left off."
      >
        <div className="stage" data-case="single">
          <XPlayer src={SOURCES[0].src} poster={POSTER} title="Single source" storageKey="dev-single" />
        </div>
      </Case>

      <Case
        id="custom"
        title="Your own video"
        note="Drag a file anywhere on this page, or paste a URL. Local files are read straight from disk."
      >
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault()
            const url = urlInput.trim()
            if (url) setCustom({ src: url, title: url.split('/').pop() || 'Video' })
          }}
        >
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Paste a video URL (.mp4, .webm or .m3u8)"
            aria-label="Video URL"
          />
          <button type="submit">Load</button>
        </form>
        {custom && (
          <div className="stage" data-case="custom">
            <XPlayer key={custom.src} src={custom.src} title={custom.title} rememberPosition={false} />
          </div>
        )}
      </Case>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
)
