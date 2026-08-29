import { useCallback, useEffect, useRef, useState } from 'react'
import { XPlayer } from '../player/XPlayer'
import type { XPlayerTrack } from '../player/types'
import { CopyBlock } from './ui/CopyBlock'
import { Comparison } from './sections/Comparison'
import { useScrollScenes } from './hooks/useScrollScenes'
import {
  CDN_BASE,
  DEMO_MEDIA,
  HLS_SAMPLE,
  ISSUES_URL,
  LOCAL_EMBED_URL,
  NPM_GITHUB_SPEC,
  REPO_URL,
  ZIP_URL,
} from './config'
import sizes from './generated/sizes.json'
import './site.css'

const kb = (bytes: number) => bytes / 1024

/** Splits a headline into words so each can be lit independently on scroll. */
function Words({ text }: { text: string }) {
  return (
    <>
      {text.split(' ').map((word, i) => (
        <span className="word-wrap" key={`${word}-${i}`}>
          <span className="word">{word}</span>{' '}
        </span>
      ))}
    </>
  )
}

const FEATURES = [
  {
    title: 'Adaptive quality',
    body: 'HLS streams switch level with the connection. The menu lists every rendition, and Auto shows which one is actually playing.',
  },
  {
    title: 'Survives bad networks',
    body: 'A stall guard watches whether playback is really advancing, not just whether an event fired, and recovers without a dialog.',
  },
  {
    title: 'Keyboard complete',
    body: 'Space, J/K/L, arrows, 0-9, M, F, C, I. Scoped to the player, so an embedded page keeps its own shortcuts.',
  },
  {
    title: 'Subtitles',
    body: 'WebVTT tracks with a language picker, and cues that stay clear of the control bar while it is on screen.',
  },
  {
    title: 'Resume where you left off',
    body: 'The position is remembered per source and offered back on return. It never seeks on its own - you accept it first.',
  },
  {
    title: 'Survives hostile CSS',
    body: 'Every class is prefixed and a defence layer neutralises host resets, including rules that use !important.',
  },
  {
    title: 'Picture in picture',
    body: 'Pop the video out and keep reading. Full screen falls back to the native video path on iPhone.',
  },
  {
    title: 'Accessible by default',
    body: 'Labelled controls, visible focus rings, and a static layout under prefers-reduced-motion.',
  },
]

const SHORTCUTS: [string, string][] = [
  ['Space / K', 'Play or pause'],
  ['J / L', 'Skip 10 seconds'],
  ['← →', 'Skip 5 seconds'],
  ['↑ ↓', 'Volume'],
  ['M', 'Mute'],
  ['F', 'Full screen'],
  ['I', 'Picture in picture'],
  ['C', 'Subtitles'],
  ['0-9', 'Jump to percent'],
  ['< >', 'Playback speed'],
]

export function Site() {
  useScrollScenes()

  return (
    <div className="site">
      <Nav />
      <Hero />
      <Embed />
      <Comparison />
      <Features />
      <Numbers />
      <Playground />
      <Install />
      <Footer />
    </div>
  )
}

/* ------------------------------------------------------------------- nav */

function Nav() {
  return (
    <nav className="nav">
      <a className="brand" href="#top">
        <span className="brand-mark" aria-hidden="true">
          X
        </span>
        <span>Player</span>
      </a>
      <div className="nav-links">
        <a href="#embed">Embed</a>
        <a href="#compare">Compare</a>
        <a href="#features">Features</a>
        <a href="#try">Try it</a>
        <a className="nav-cta" href={REPO_URL} target="_blank" rel="noreferrer noopener">
          GitHub
        </a>
      </div>
    </nav>
  )
}

/* ------------------------------------------------------------------ hero */

function Hero() {
  return (
    <section className="scene scene-hero" data-scene="hero" id="top">
      <div className="layer depth-0" data-depth="0" aria-hidden="true">
        <div className="wash wash-hero" />
      </div>
      <div className="layer depth-1" data-depth="1" aria-hidden="true">
        <div className="blob blob-a" />
        <div className="blob blob-b" />
      </div>
      <div className="layer depth-2" data-depth="2" aria-hidden="true">
        <span className="chip chip-1">HLS</span>
        <span className="chip chip-2">WebVTT</span>
        <span className="chip chip-3">Picture in picture</span>
        <span className="chip chip-4">{kb(sizes.embed.gzip).toFixed(0)} kB gzip</span>
      </div>

      <div className="scene-stage">
        <div className="hero-copy layer depth-4" data-depth="4">
          <h1 data-anim="light-words">
            <Words text="A video player that does not stall." />
          </h1>
          <p className="hero-lede">
            Drop it into any page with one script tag. It handles MP4, WebM and HLS, drops quality when the
            network gets bad, and picks itself back up when the connection returns.
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary" href="#install">
              Install
            </a>
            <a className="btn btn-ghost" href="#compare">
              See the difference
            </a>
          </div>
        </div>

        <div className="hero-player layer depth-3" data-depth="3" data-anim="hero-player">
          <XPlayer
            src={DEMO_MEDIA.webm}
            poster={DEMO_MEDIA.poster}
            title="Sintel (excerpt)"
            tracks={DEMO_MEDIA.tracks}
            rememberPosition={false}
            accent="#7dd3fc"
          />
        </div>
      </div>

      <div className="layer depth-5 grain" data-depth="5" aria-hidden="true" />
    </section>
  )
}

/* ----------------------------------------------------------------- embed */

const REACT_SNIPPET = `import { XPlayer } from 'x-player'
import 'x-player/style.css'

export function Watch() {
  return (
    <XPlayer
      src="/video.m3u8"
      title="Product tour"
      accent="#7dd3fc"
    />
  )
}`

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

function Embed() {
  const [tab, setTab] = useState<'react' | 'html' | 'nocode'>('html')

  const snippets = {
    react: { code: REACT_SNIPPET, note: 'For React apps. hls.js loads lazily, only when a source needs it.' },
    html: { code: HTML_SNIPPET, note: 'No build step. React and the stylesheet are inside the one file.' },
    nocode: { code: NOCODE_SNIPPET, note: 'Every [data-x-player] element on the page is mounted automatically.' },
  }

  return (
    <section className="scene scene-embed" data-scene="embed" id="embed">
      <div className="layer depth-1" data-depth="1" aria-hidden="true">
        <div className="blob blob-embed" />
      </div>

      <div className="scene-inner layer depth-4" data-depth="4">
        <header className="section-head">
          <p className="eyebrow">Install</p>
          <h2 data-anim="light-words">
            <Words text="One tag. No build step." />
          </h2>
          <p className="section-lede">
            The embed bundle is {kb(sizes.embed.gzip).toFixed(1)} kB gzipped and carries its own renderer and
            styles. Streaming support is a separate file that only downloads when an HLS source is opened.
          </p>
        </header>

        <div className="tabs" role="tablist" aria-label="Embedding method">
          {(
            [
              ['html', 'Plain HTML'],
              ['nocode', 'No code'],
              ['react', 'React'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`tab${tab === id ? ' is-active' : ''}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div data-anim="wipe">
          <CopyBlock label={tab === 'react' ? 'React' : tab === 'html' ? 'HTML' : 'HTML, no JavaScript'} code={snippets[tab].code} note={snippets[tab].note} />
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------- features */

function Features() {
  return (
    <section className="scene scene-features" data-scene="features" id="features">
      <div className="layer depth-1" data-depth="1" aria-hidden="true">
        <div className="blob blob-features" />
      </div>
      <div className="scene-inner layer depth-4" data-depth="4">
        <header className="section-head">
          <p className="eyebrow">What is in it</p>
          <h2 data-anim="light-words">
            <Words text="Everything people expect, nothing they have to learn." />
          </h2>
        </header>
        <div className="card-grid">
          {FEATURES.map((f) => (
            <article className="feature-card" data-anim="stack-card" key={f.title}>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

/* --------------------------------------------------------------- numbers */

function Numbers() {
  const stats = [
    { value: kb(sizes.embed.gzip), decimals: 1, unit: 'kB', label: 'Embed bundle, gzipped', sub: 'Renderer and styles included' },
    { value: kb(sizes.libJs.gzip), decimals: 1, unit: 'kB', label: 'React library, gzipped', sub: 'Plus ' + kb(sizes.libCss.gzip).toFixed(1) + ' kB of CSS' },
    { value: kb(sizes.hls.gzip), decimals: 0, unit: 'kB', label: 'Streaming support', sub: 'Only fetched for HLS sources' },
    { value: 1, decimals: 0, unit: '', label: 'Runtime dependency', sub: 'hls.js, and only when streaming' },
  ]

  return (
    <section className="scene scene-numbers" data-scene="numbers">
      <div className="layer depth-1" data-depth="1" aria-hidden="true">
        <div className="blob blob-numbers" />
      </div>
      <div className="scene-inner layer depth-4" data-depth="4">
        <header className="section-head">
          <p className="eyebrow">Weight</p>
          <h2 data-anim="light-words">
            <Words text="Small enough to stop thinking about." />
          </h2>
        </header>
        <div className="stat-row">
          {stats.map((s) => (
            <div className="stat" data-anim="rise" key={s.label}>
              <p className="stat-value">
                <span data-count={s.value.toFixed(s.decimals)} data-count-decimals={s.decimals}>
                  {s.value.toFixed(s.decimals)}
                </span>
                {s.unit && <span className="stat-unit">{s.unit}</span>}
              </p>
              <p className="stat-label">{s.label}</p>
              <p className="stat-sub">{s.sub}</p>
            </div>
          ))}
        </div>
        <p className="stat-footnote">
          Measured from the build output on {sizes.measuredAt} by <code>scripts/measure-sizes.mjs</code>, which
          writes these numbers into the page. They are not typed in by hand and cannot drift from the files
          this repository ships.
        </p>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------ playground */

interface Sample {
  label: string
  src: string
  title: string
  poster?: string
  hint: string
  tracks?: XPlayerTrack[]
}

const SAMPLES: Sample[] = [
  {
    label: 'MP4',
    src: DEMO_MEDIA.mp4,
    title: 'Sintel (MP4)',
    poster: DEMO_MEDIA.poster,
    hint: 'Progressive, with subtitles',
    tracks: DEMO_MEDIA.tracks,
  },
  {
    label: 'WebM',
    src: DEMO_MEDIA.webm,
    title: 'Sintel (WebM)',
    poster: DEMO_MEDIA.poster,
    hint: 'Same clip, open format',
    tracks: DEMO_MEDIA.tracks,
  },
  {
    label: 'HLS',
    src: HLS_SAMPLE,
    title: 'Tears of Steel (HLS)',
    hint: 'Adaptive quality, six renditions',
  },
]

function Playground() {
  const [source, setSource] = useState<{ src: string; title: string; poster?: string; tracks?: XPlayerTrack[] }>({
    src: SAMPLES[0].src,
    title: SAMPLES[0].title,
    poster: SAMPLES[0].poster,
    tracks: SAMPLES[0].tracks,
  })
  const [urlInput, setUrlInput] = useState('')
  const [dragging, setDragging] = useState(false)
  const [isLocal, setIsLocal] = useState(false)
  const objectUrlRef = useRef<string | null>(null)

  const playLocalFile = useCallback((file: File) => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    const url = URL.createObjectURL(file)
    objectUrlRef.current = url
    setIsLocal(true)
    setSource({ src: url, title: file.name })
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
    setIsLocal(false)
    setSource({ src: url, title: url.split('/').pop() || 'Video' })
  }

  return (
    <section className="scene scene-play" data-scene="play" id="try">
      {dragging && (
        <div className="dropzone">
          <div className="dropzone-card">
            <p className="dropzone-title">Drop a video here</p>
            <p className="dropzone-sub">It never leaves your browser. Nothing is uploaded.</p>
          </div>
        </div>
      )}

      <div className="layer depth-1" data-depth="1" aria-hidden="true">
        <div className="blob blob-play" />
      </div>

      <div className="scene-inner layer depth-4" data-depth="4">
        <header className="section-head">
          <p className="eyebrow">Try it</p>
          <h2 data-anim="light-words">
            <Words text="Use your own video." />
          </h2>
          <p className="section-lede">
            Drag a file anywhere on this page, or paste a URL. Local files are read straight from disk with an
            object URL and never uploaded anywhere.
          </p>
        </header>

        <div className="play-stage" data-anim="rise">
          <XPlayer
            key={source.src}
            src={source.src}
            title={source.title}
            poster={source.poster}
            tracks={source.tracks}
            accent="#7dd3fc"
          />
        </div>

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
          {SAMPLES.map((s) => (
            <button
              key={s.src}
              type="button"
              className={`sample${source.src === s.src ? ' is-active' : ''}`}
              onClick={() => {
                setIsLocal(false)
                setSource({ src: s.src, title: s.title, poster: s.poster, tracks: s.tracks })
              }}
            >
              <strong>{s.label}</strong>
              <span>{s.hint}</span>
            </button>
          ))}
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

        {isLocal && (
          <p className="play-note">
            Playing a local file. The snippets below use a placeholder URL, since an object URL only exists in
            this tab.
          </p>
        )}
      </div>
    </section>
  )
}

/* --------------------------------------------------------------- install */

function Install() {
  return (
    <section className="scene scene-install" data-scene="install" id="install">
      <div className="layer depth-1" data-depth="1" aria-hidden="true">
        <div className="blob blob-install" />
      </div>
      <div className="scene-inner layer depth-4" data-depth="4">
        <header className="section-head">
          <p className="eyebrow">Get it</p>
          <h2 data-anim="light-words">
            <Words text="Three ways in." />
          </h2>
        </header>

        <div className="install-grid">
          <article className="install-card" data-anim="stack-card">
            <h3>Download</h3>
            <p>Grab the repository and copy two files out of it, or take the built bundle straight from this site.</p>
            <div className="install-links">
              <a className="btn btn-primary" href={ZIP_URL}>
                Download ZIP
              </a>
              <a className="btn btn-ghost" href={LOCAL_EMBED_URL} download>
                x-player.iife.js
              </a>
            </div>
          </article>

          <article className="install-card" data-anim="stack-card">
            <h3>Package manager</h3>
            <p>Installs straight from GitHub and builds itself on install. React and react-dom are peers.</p>
            <CopyBlock label="Terminal" code={`npm install ${NPM_GITHUB_SPEC}`} />
          </article>

          <article className="install-card" data-anim="stack-card">
            <h3>CDN</h3>
            <p>
              jsDelivr serves tagged releases from GitHub, so nothing needs publishing to npm. Pin the tag and
              add the integrity hash printed by <code>npm run build:embed</code>.
            </p>
            <CopyBlock
              label="HTML"
              code={`<script src="${CDN_BASE}/x-player.iife.js"\n        crossorigin="anonymous"></script>`}
            />
          </article>
        </div>

        <div className="shortcuts-block" data-anim="rise">
          <h3>Keyboard</h3>
          <ul className="shortcuts">
            {SHORTCUTS.map(([key, desc]) => (
              <li key={key}>
                <kbd>{key}</kbd>
                <span>{desc}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- footer */

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <p>
          <strong>X-Player</strong> &mdash; MIT licensed. <a href={REPO_URL}>Source</a> &middot;{' '}
          <a href={ISSUES_URL}>Issues</a>
        </p>
        <p className="footer-credit">
          Demo clip: an excerpt from the <em>Sintel</em> trailer, &copy; Blender Foundation, used under{' '}
          <a href="https://creativecommons.org/licenses/by/3.0/" rel="noreferrer noopener" target="_blank">
            CC BY 3.0
          </a>
          . HLS sample stream by Mux.
        </p>
      </div>
    </footer>
  )
}

export default Site
