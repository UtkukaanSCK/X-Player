import { useCallback, useEffect, useRef, useState } from 'react'
import { XPlayer } from '../player/XPlayer'
import type { XPlayerSource, XPlayerTrack } from '../player/types'
import { CopyBlock } from './ui/CopyBlock'
import { PlayheadRail, type Chapter } from './ui/PlayheadRail'
import { Comparison } from './sections/Comparison'
import { useScrollScenes } from './hooks/useScrollScenes'
import {
  CDN_BASE,
  DEMO_POSTER,
  DEMO_SOURCES,
  DEMO_TRACKS,
  HLS_SAMPLE,
  ISSUES_URL,
  LOCAL_EMBED_URL,
  NPM_GITHUB_SPEC,
  REPO_URL,
} from './config'
import sizes from './generated/sizes.json'
import './site.css'

const kb = (bytes: number) => bytes / 1024

const CHAPTERS: Chapter[] = [
  { id: 'top', label: 'Opening' },
  { id: 'compare', label: 'The proof' },
  { id: 'install', label: 'Install' },
  { id: 'try', label: 'Try it' },
]

export function Site() {
  useScrollScenes()

  return (
    <div className="site">
      <TopBar />
      <PlayheadRail chapters={CHAPTERS} />
      <main className="stack">
        <Hero />
        <Comparison />
        <Install />
        <Playground />
      </main>
      <Footer />
    </div>
  )
}

/* ---------------------------------------------------------------- top bar */

function TopBar() {
  return (
    <header className="topbar">
      <a className="brand" href="#top">
        <span className="brand-mark" aria-hidden="true">
          ▶
        </span>
        <span className="brand-name">X-Player</span>
        <span className="brand-version">v1.0.0</span>
      </a>
      <a className="btn btn-quiet" href={REPO_URL} target="_blank" rel="noreferrer noopener">
        View on GitHub
      </a>
    </header>
  )
}

/* ------------------------------------------------------------------- hero */

const HERO_SPECS = [
  { value: `${kb(sizes.embed.gzip).toFixed(1)} kB`, label: 'embed bundle, gzipped' },
  { value: `${kb(sizes.libJs.gzip).toFixed(1)} kB`, label: 'React build, gzipped' },
  { value: '1', label: 'runtime dependency' },
  { value: '0', label: 'build steps required' },
]

function Hero() {
  return (
    <section className="scene hero" data-scene="hero" id="top">
      <div className="scene-head">
        <p className="marker">00:00:00 — Opening</p>
      </div>

      <div className="hero-grid">
        <div className="hero-copy">
          <h1>
            <span className="line">A video player</span>
            <span className="line accent">that does not stall.</span>
          </h1>
          <p className="lede">
            Drop it into any page with one script tag. MP4, WebM and HLS. When the connection gets bad it
            says so, keeps trying, and picks up where it left off.
          </p>
          <div className="actions">
            <a className="btn btn-primary" href="#install">
              Install
            </a>
            <a className="btn btn-outline" href="#compare">
              See the proof
            </a>
          </div>
        </div>

        <div className="hero-player" data-anim="hero-player">
          <XPlayer
            sources={DEMO_SOURCES}
            poster={DEMO_POSTER}
            title="Sintel (excerpt)"
            tracks={DEMO_TRACKS}
            rememberPosition={false}
            accent="#FFB020"
          />
          <p className="hero-hint">
            Settings → Quality switches between three encodes of this clip without losing your place.
          </p>
        </div>
      </div>

      <dl className="specstrip">
        {HERO_SPECS.map((s) => (
          <div key={s.label}>
            <dt>{s.value}</dt>
            <dd>{s.label}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/* ---------------------------------------------------------------- install */

const REACT_SNIPPET = `import { XPlayer } from 'x-player'
import 'x-player/style.css'

<XPlayer
  src="/video.m3u8"
  title="Product tour"
  accent="#FFB020"
/>`

const HTML_SNIPPET = `<div id="player"></div>

<script src="${CDN_BASE}/x-player.iife.js"
        crossorigin="anonymous"></script>
<script>
  XPlayer.mount('#player', {
    src: '/video.mp4',
    title: 'Product tour'
  })
</script>`

const NOCODE_SNIPPET = `<script src="${CDN_BASE}/x-player.iife.js"
        crossorigin="anonymous"></script>

<div data-x-player
     data-src="/video.mp4"
     data-title="Product tour"></div>`

const TABS = [
  { id: 'html', label: 'Plain HTML', code: HTML_SNIPPET, note: 'No build step. The renderer and the styles are inside the one file.' },
  { id: 'nocode', label: 'No JavaScript', code: NOCODE_SNIPPET, note: 'Every [data-x-player] element on the page is mounted when the script loads.' },
  { id: 'react', label: 'React', code: REACT_SNIPPET, note: 'react and react-dom are peers. hls.js is imported lazily.' },
] as const

const SPECS: [string, string][] = [
  ['Formats', 'MP4, WebM, HLS (live and on demand)'],
  ['Quality', 'HLS renditions, or several files you supply'],
  ['Subtitles', 'WebVTT with a language picker'],
  ['Keyboard', 'Space, J/K/L, arrows, 0–9, M, F, C, I'],
  ['Resume', 'Position remembered per video, offered on return'],
  ['Windows', 'Picture in picture, full screen with an iOS fallback'],
  ['Isolation', 'Prefixed classes and a defence layer against host CSS'],
  ['Motion', 'Static layout under prefers-reduced-motion'],
]

function Install() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('html')
  const current = TABS.find((t) => t.id === tab) ?? TABS[0]

  return (
    <section className="scene" data-scene="install" id="install">
      <div className="scene-head">
        <p className="marker">Install</p>
        <h2>
          One tag.
          <br />
          No build step.
        </h2>
        <p className="lede">
          The embed bundle is {kb(sizes.embed.gzip).toFixed(1)} kB gzipped and carries its own renderer and
          styles. Streaming support is a second file that downloads only when an HLS source is opened.
        </p>
      </div>

      <div className="install-grid">
        <div className="install-code">
          <div className="tabs" role="tablist" aria-label="Embedding method">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={`tab${tab === t.id ? ' is-active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <CopyBlock label={current.label} code={current.code} note={current.note} />

          <div className="install-more">
            <CopyBlock label="Install from GitHub" code={`npm install ${NPM_GITHUB_SPEC}`} />
            <p className="fineprint">
              Or take the single file:{' '}
              <a href={LOCAL_EMBED_URL} download>
                x-player.iife.js
              </a>
              . Every build prints an SRI hash for it, so a CDN copy can be pinned and verified.
            </p>
            <a className="btn btn-primary" href={REPO_URL} target="_blank" rel="noreferrer noopener">
              View on GitHub
            </a>
          </div>
        </div>

        <dl className="spec-list">
          {SPECS.map(([term, detail]) => (
            <div key={term} data-anim="row">
              <dt>{term}</dt>
              <dd>{detail}</dd>
            </div>
          ))}
        </dl>
      </div>

      <p className="footnote">
        Sizes measured from the build output on {sizes.measuredAt} by <code>scripts/measure-sizes.mjs</code>,
        which writes them into this page. They are not typed in by hand and cannot drift from what the
        repository ships.
      </p>
    </section>
  )
}

/* ------------------------------------------------------------- playground */

interface Sample {
  label: string
  hint: string
  src?: string
  sources?: XPlayerSource[]
  title: string
  poster?: string
  tracks?: XPlayerTrack[]
}

const SAMPLES: Sample[] = [
  {
    label: 'Three encodes',
    hint: '480p / 360p / 240p, switchable',
    sources: DEMO_SOURCES,
    title: 'Sintel (excerpt)',
    poster: DEMO_POSTER,
    tracks: DEMO_TRACKS,
  },
  {
    label: 'HLS stream',
    hint: 'Six renditions, chosen automatically',
    src: HLS_SAMPLE,
    title: 'Tears of Steel',
  },
]

function Playground() {
  const [source, setSource] = useState<Sample>(SAMPLES[0])
  const [urlInput, setUrlInput] = useState('')
  const [dragging, setDragging] = useState(false)
  const objectUrlRef = useRef<string | null>(null)

  const playLocalFile = useCallback((file: File) => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    const url = URL.createObjectURL(file)
    objectUrlRef.current = url
    setSource({ label: 'Your file', hint: '', src: url, title: file.name })
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

  const applyUrl = (e: React.FormEvent) => {
    e.preventDefault()
    const url = urlInput.trim()
    if (!url) return
    setSource({ label: 'From URL', hint: '', src: url, title: url.split('/').pop() || 'Video' })
  }

  const key = source.src ?? source.sources?.[0]?.src ?? ''

  return (
    <section className="scene" data-scene="try" id="try">
      {dragging && (
        <div className="dropzone">
          <p className="dropzone-title">Drop a video here</p>
          <p className="dropzone-sub">It never leaves your browser. Nothing is uploaded.</p>
        </div>
      )}

      <div className="scene-head">
        <p className="marker">Try it</p>
        <h2>Use your own video.</h2>
        <p className="lede">
          Drag a file anywhere on this page, or paste a URL. Local files are read straight from disk and
          never uploaded.
        </p>
      </div>

      <div className="play-stage">
        <XPlayer
          key={key}
          src={source.src}
          sources={source.sources}
          title={source.title}
          poster={source.poster}
          tracks={source.tracks}
          accent="#FFB020"
        />
      </div>

      <div className="play-controls">
        <form className="url-form" onSubmit={applyUrl}>
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Paste a video URL (.mp4, .webm or .m3u8)"
            aria-label="Video URL"
          />
          <button type="submit">Load</button>
        </form>

        <div className="samples">
          {SAMPLES.map((s) => {
            const id = s.src ?? s.sources?.[0]?.src
            return (
              <button
                key={id}
                type="button"
                className={`sample${key === id ? ' is-active' : ''}`}
                onClick={() => setSource(s)}
              >
                <strong>{s.label}</strong>
                <span>{s.hint}</span>
              </button>
            )
          })}
          <label className="sample sample-file">
            <strong>Your file</strong>
            <span>Drag in, or browse</span>
            <input
              type="file"
              accept="video/*"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) playLocalFile(file)
              }}
            />
          </label>
        </div>
      </div>
    </section>
  )
}

/* ----------------------------------------------------------------- footer */

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-row">
        <p>
          <strong>X-Player</strong> — MIT licensed
        </p>
        <p>
          <a href={REPO_URL}>Source</a> · <a href={ISSUES_URL}>Issues</a>
        </p>
      </div>
      <p className="fineprint">
        Demo clip: an excerpt from the <em>Sintel</em> trailer, © Blender Foundation, used under{' '}
        <a href="https://creativecommons.org/licenses/by/3.0/" rel="noreferrer noopener" target="_blank">
          CC BY 3.0
        </a>
        . HLS sample stream by Mux.
      </p>
    </footer>
  )
}

export default Site
