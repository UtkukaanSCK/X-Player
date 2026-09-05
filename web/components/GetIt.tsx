'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'

import { assetsFor, MEASURED_AT, SNIPPETS, type Playing, type Target, type Use } from '@/lib/downloads'
import {
  APP_REPO,
  APP_RELEASES,
  APP_VERSION,
  DOWNLOADS,
  downloadUrl,
  guessPlatform,
  published,
  sourcePublished,
  type PlatformId,
} from '@/lib/releases'

/**
 * Two questions, then the exact thing you need.
 *
 * A wizard earns its place here because the two audiences want opposite things
 * and neither should have to read past the other's answer: someone with a folder
 * of films wants an installer, someone with a website wants the smallest file
 * that will play video on it. Asking is shorter than explaining both.
 *
 * The second branch subtracts rather than adds. Choose MP4 and the 184 kB
 * streaming engine is absent from the list entirely, because a page that never
 * opens a stream never fetches it - which is the most interesting thing about
 * this player and only shows if the page takes things away.
 */

const USES: { id: Use; label: string; hint: string }[] = [
  { id: 'watch', label: 'Watch files on my computer', hint: 'MKV, AVI, HEVC — the desktop app' },
  { id: 'embed', label: 'Put a player on my site', hint: 'The library, as small as it goes' },
]

const TARGETS: { id: Target; label: string; hint: string }[] = [
  { id: 'html', label: 'A plain HTML page', hint: 'You host one file' },
  { id: 'react', label: 'A React app', hint: 'Your bundler handles it' },
  { id: 'cdn', label: 'Neither, use a CDN', hint: 'Nothing to host at all' },
]

const PLAYING: { id: Playing; label: string; hint: string }[] = [
  { id: 'files', label: 'MP4 or WebM files', hint: 'Video you host' },
  { id: 'stream', label: 'An HLS stream', hint: '.m3u8, live or on demand' },
]

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} kB`

export function GetIt() {
  const container = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()

  const [use, setUse] = useState<Use>('watch')
  const [target, setTarget] = useState<Target>('html')
  const [playing, setPlaying] = useState<Playing>('files')
  const [platform, setPlatform] = useState<PlatformId | null>(null)

  // After mount: the server has no user agent, and guessing during render would
  // make the markup disagree with itself.
  useEffect(() => setPlatform(guessPlatform(navigator.userAgent)), [])

  const { scrollYProgress } = useScroll({ target: container, offset: ['start end', 'center center'] })
  const y = useTransform(scrollYProgress, [0, 0.35], reduced ? [0, 0] : [80, 0])
  const opacity = useTransform(scrollYProgress, [0, 0.3], reduced ? [1, 1] : [0, 1])

  /*
   * A section that has been tabbed into stops hiding.
   *
   * The reveal is driven by scroll, and an element faded to nothing is still in
   * the tab order - so a keyboard user could land on a download link that was
   * not on the screen. Marking the section inert until it is revealed would be
   * worse: someone who never scrolls could then never reach it at all. Focus
   * settles the animation instead, which is the one reading of "reveal" that
   * serves both.
   */
  const [revealed, setRevealed] = useState(false)

  return (
    <section
      ref={container}
      id="get"
      /*
       * No viewport-height floor here.
       *
       * The two answers are very different sizes - the library one is a list of
       * files and a code sample, the desktop one is two sentences and a button -
       * and a floor measured in vh sized the section for the tall answer, so
       * the short one sat marooned in a third of a screen of nothing. Padding
       * gives it room; the content decides the rest.
       */
      aria-labelledby="get-heading"
      className="relative flex items-center justify-center px-5 py-24 sm:px-8 sm:py-28"
    >
      <motion.div
        style={revealed ? { y: 0, opacity: 1 } : { y, opacity }}
        /*
         * Keyboard focus only.
         *
         * Settling on any focus meant a mouse press snapped the section 80px
         * up between mousedown and mouseup, so the card slid out from under the
         * cursor and the click never landed. :focus-visible is exactly the
         * distinction wanted here - it is true when the browser would draw a
         * focus ring, which is the case this exists for.
         */
        onFocus={(event) => {
          if (event.target instanceof Element && event.target.matches(':focus-visible')) setRevealed(true)
        }}
        className="mx-auto w-full max-w-5xl"
      >
        <h2
          id="get-heading"
          className="legend max-w-3xl text-[length:var(--text-section)] font-semibold leading-[1.02] text-balance"
        >
          Take only what you need.
        </h2>

        {/*
          The two columns arrive at md, not lg.
          Between 640 and 1024 the section was a single stack inside a 64rem
          container, so a two-word option label sat on a 700px line and the
          file rows threw name and size to opposite ends of it. The questions
          take the narrower column because they are short by nature.
        */}
        <div className="mt-9 grid gap-8 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] md:gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:gap-10">
          <div className="grid gap-7">
            <Question
              step="01"
              label="What are you doing?"
              options={USES}
              value={use}
              onChange={(next) => setUse(next as Use)}
            />

            {use === 'embed' && (
              <>
                <Question
                  step="02"
                  label="Where does it go?"
                  options={TARGETS}
                  value={target}
                  onChange={(next) => setTarget(next as Target)}
                />
                <Question
                  step="03"
                  label="What will it play?"
                  options={PLAYING}
                  value={playing}
                  onChange={(next) => setPlaying(next as Playing)}
                />
              </>
            )}
          </div>

          {/*
            One Manifest, not one per branch.
            A live region has to be in the document before its contents change:
            an element inserted together with its text is usually announced by
            nothing at all. Rendering AppResult or FilesResult here made React
            destroy the region and build a new one on every switch, so the
            announcement it exists for never happened. Same element, same
            position, changing children.
          */}
          <div className="grid gap-4">
            <Manifest
              title={use === 'watch' ? 'The desktop app' : 'What you need'}
              count={use === 'watch' ? `version ${APP_VERSION}` : fileCount(target, playing)}
            >
              {use === 'watch' ? (
                <AppResult platform={platform} />
              ) : (
                <FilesResult target={target} playing={playing} />
              )}
            </Manifest>
            {use === 'embed' && <Snippet target={target} />}
          </div>
        </div>
      </motion.div>
    </section>
  )
}

/* ------------------------------------------------------------------ questions */

function Question({
  step,
  label,
  options,
  value,
  onChange,
}: {
  step: string
  label: string
  options: { id: string; label: string; hint: string }[]
  value: string
  onChange: (id: string) => void
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([])

  /* Arrow keys move and choose; only the chosen card is a tab stop. Three
     groups of independently tabbable buttons made seven stops out of three. */
  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown'
    const back = event.key === 'ArrowLeft' || event.key === 'ArrowUp'
    if (!forward && !back) return
    event.preventDefault()
    const next = (index + (forward ? 1 : -1) + options.length) % options.length
    buttons.current[next]?.focus()
    onChange(options[next].id)
  }

  return (
    <div>
      <p className="mb-3 flex items-baseline gap-2.5 text-title text-paper">
        <span className="font-mono text-micro tracking-[0.06em] text-good">{step}</span>
        {label}
      </p>
      <div className="grid gap-2" role="radiogroup" aria-label={label}>
        {options.map((option, index) => {
          const on = value === option.id
          return (
            <button
              key={option.id}
              ref={(node) => {
                buttons.current[index] = node
              }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(option.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              /*
               * The resting border is `faint`, not a hairline. This card is a
               * control and its outline is the only thing that says so, which
               * is the case WCAG asks 3:1 of; the decorative rules elsewhere on
               * the page are a tenth of that and rightly so.
               */
              className={`grid gap-0.5 rounded-lg border border-l-2 px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-good ${
                on
                  ? 'border-faint border-l-good bg-good/10'
                  : 'border-faint border-l-faint bg-transparent hover:bg-panel active:bg-raised'
              }`}
            >
              <span className={`text-lead ${on ? 'text-good' : 'text-paper'}`}>{option.label}</span>
              <span className="font-mono text-micro text-muted">{option.hint}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/*
 * A control that leads somewhere, resting on a border that meets the 3:1 a
 * control's outline is asked for. Amber is gone from it on purpose: a page with
 * one accent cannot spend it on wherever the cursor happens to be.
 */
const ACTION =
  'inline-flex min-h-11 items-center rounded-md border border-faint px-3.5 py-2 font-mono text-micro text-paper transition-colors hover:bg-raised active:bg-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-good'

function fileCount(target: Target, playing: Playing) {
  const n = assetsFor(target, playing).length
  return `${n} file${n === 1 ? '' : 's'}`
}

/* ------------------------------------------------------------------- the app */

function AppResult({ platform }: { platform: PlatformId | null }) {
  const ordered = platform
    ? [...DOWNLOADS].sort((a, b) => Number(b.id === platform) - Number(a.id === platform))
    : DOWNLOADS

  if (!published) {
    return (
      <div className="px-4 py-4">
        <p className="text-body leading-relaxed text-paper">
          Not released yet. It builds and runs — the Windows installer is {DOWNLOADS[0].sizeMb} MB and has been
          produced and used — but nothing has been published to download.
        </p>
        {sourcePublished ? (
          <a href={APP_REPO} target="_blank" rel="noreferrer noopener" className={`mt-4 ${ACTION}`}>
            Build it from source
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : (
          <p className="mt-4 text-caption leading-relaxed text-muted">
            The source is not on GitHub yet either, so there is nothing to link to. It goes up with the
            release.
          </p>
        )}
        <p className="mt-3 text-caption leading-relaxed text-muted">
          Verified on Windows. macOS and Linux are configured but never run.
        </p>
      </div>
    )
  }

  return (
    <>
      {ordered.map((download, index) => (
        <div key={download.id} className="border-b border-line px-4 py-3.5 last:border-b-0">
          <div className="flex items-baseline justify-between gap-3">
            <span
              className={`font-mono text-body ${index === 0 && download.id === platform ? 'text-good' : 'text-paper'}`}
            >
              {download.label}
            </span>
            <span className="font-mono text-micro text-muted">
              {download.sizeMb ? `${download.sizeMb} MB` : '—'}
            </span>
          </div>
          <p className="mt-1.5 font-mono text-micro text-muted">{download.format}</p>
          <p className="mt-1.5 text-caption leading-relaxed text-muted">{download.note}</p>
          {download.released && !download.verified && (
            <p className="mt-1.5 font-mono text-micro text-bad">Built but never run on this platform</p>
          )}
          {download.released ? (
            <a href={downloadUrl(download.file)} className={`mt-3 ${ACTION}`}>
              Download {download.label}
            </a>
          ) : (
            /* No button. The file is not in the release, and a button that
               answers 404 is worse than a sentence saying why there isn't one. */
            <p className="mt-3 font-mono text-micro text-muted">Not in this release yet</p>
          )}
        </div>
      ))}
      <p className="px-4 py-3 font-mono text-micro text-muted">
        <a
          href={APP_RELEASES}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex min-h-11 items-center rounded-xs underline underline-offset-4 hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-good"
        >
          All releases and checksums
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </p>
    </>
  )
}

/* --------------------------------------------------------------- the library */

function FilesResult({ target, playing }: { target: Target; playing: Playing }) {
  const assets = assetsFor(target, playing)
  const upfront = assets.filter((a) => !a.lazy).reduce((sum, a) => sum + a.gzip, 0)
  const deferred = assets.filter((a) => a.lazy).reduce((sum, a) => sum + a.gzip, 0)

  return (
    <>
      {assets.map((asset) => (
        <div
          key={asset.name}
          className={`border-b border-line px-4 py-3.5 last:border-b-0 ${asset.lazy ? 'bg-ground/40' : ''}`}
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-mono text-body text-paper">{asset.name}</span>
            {/* The gzip figure leads on size, not on colour: it is a measurement
                taken once, not a reading that is changing. */}
            <span className="grid justify-items-end font-mono text-body text-paper">
              {kb(asset.gzip)}
              <span className="text-micro text-muted">{kb(asset.raw)} raw</span>
            </span>
          </div>
          <p className="mt-1.5 font-mono text-micro text-muted">{asset.place}</p>
          <p className="mt-1.5 text-caption leading-relaxed text-muted">{asset.what}</p>
          {asset.href && (
            <a
              href={asset.href}
              download={asset.href.startsWith('http') ? undefined : ''}
              className={`mt-3 ${ACTION}`}
            >
              {asset.href.startsWith('http') ? 'Open on the CDN' : `Download ${asset.name}`}
            </a>
          )}
        </div>
      ))}

      <dl className="border-t border-line px-4 py-3.5">
        <div className="flex items-baseline justify-between gap-3 py-1">
          <dt className="font-mono text-micro tracking-[0.02em] text-muted">On every page load</dt>
          <dd className="font-mono text-figure text-paper">{kb(upfront)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 py-1">
          <dt className="font-mono text-micro tracking-[0.02em] text-muted">Only when a stream opens</dt>
          <dd className={`font-mono ${deferred ? 'text-figure text-paper' : 'text-caption text-muted'}`}>
            {deferred ? kb(deferred) : 'nothing'}
          </dd>
        </div>
      </dl>
    </>
  )
}

function Snippet({ target }: { target: Target }) {
  const snippet = SNIPPETS[target]
  return (
    <div className="grid gap-4">
      <div className="overflow-hidden rounded-xl border border-line bg-panel">
        <p id="snippet-label" className="border-b border-line px-4 py-2.5 font-mono text-micro tracking-[0.04em] text-muted">
          {snippet.label}
        </p>
        {/* Scrollable, so it has to be reachable by keyboard - a region a mouse
            can pan and a keyboard cannot is content some people simply lose. */}
        <pre
          tabIndex={0}
          role="region"
          aria-labelledby="snippet-label"
          className="overflow-x-auto px-4 py-3.5 font-mono text-caption leading-relaxed text-paper focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-good"
        >
          <code>{snippet.code}</code>
        </pre>
        <p className="border-t border-line px-4 py-2.5 text-caption leading-relaxed text-muted">{snippet.note}</p>
      </div>

      <p className="font-mono text-micro text-muted">
        Sizes measured from the files above on {MEASURED_AT}, not typed in.
      </p>
    </div>
  )
}

function Manifest({ title, count, children }: { title: string; count: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-panel" aria-live="polite">
      <p className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-2.5 font-mono text-micro tracking-[0.04em] text-muted">
        <span>{title}</span>
        <span>{count}</span>
      </p>
      {children}
    </div>
  )
}
