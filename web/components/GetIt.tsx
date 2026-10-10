'use client'

import { useRef, useState, useSyncExternalStore } from 'react'

import { assetsFor, EMBED_GZIP, MEASURED_AT, SNIPPETS, type Playing, type Target, type Use } from '@/lib/downloads'
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
import { FOCUS_INSET, PRIMARY, SECONDARY, TEXT_LINK } from './ui'

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

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} kB`

const USES: { id: Use; label: string; hint: string }[] = [
  { id: 'watch', label: 'Watch files on my computer', hint: 'The desktop app. Plays MKV, AVI and HEVC.' },
  { id: 'embed', label: 'Put a player on my site', hint: `The drop-in script is ${kb(EMBED_GZIP)} gzipped` },
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

/*
 * A borderless tile on the band. Under more contrast it gets the edge a control
 * has. Forced colours paint band and tile the same Canvas, so there a border is
 * the only thing left that shows where a tile is.
 */
const TILE =
  'overflow-hidden rounded-tile bg-tile contrast-more:ring-1 contrast-more:ring-control contrast-more:ring-inset forced-colors:border'

/*
 * A tint inside a tile: the code strip and a file loaded later. In light it is
 * `raised`, not `panel`, because panel is the band's own grey and a strip of it
 * across a white tile read as a hole cut through to the band. In dark the tile
 * is already lighter than the band and panel lighter again, so it stays.
 */
const STRIP = 'bg-raised dark:bg-panel'

/* The user agent never changes, so there is nothing to subscribe to. */
const subscribeToNothing = () => () => {}

export function GetIt() {
  const [use, setUse] = useState<Use>('watch')
  const [target, setTarget] = useState<Target>('html')
  const [playing, setPlaying] = useState<Playing>('files')

  /*
   * The server has no user agent, so it renders as if the platform were
   * unknown, and so does the first render on the client; the guess arrives in
   * the render straight after. Guessing during that first render would make the
   * markup disagree with itself.
   */
  const platform = useSyncExternalStore<PlatformId | null>(
    subscribeToNothing,
    () => guessPlatform(navigator.userAgent),
    () => null,
  )

  return (
    <section
      id="get"
      /*
       * No viewport-height floor here.
       *
       * The two answers are very different sizes - the library one is a list of
       * files and a code sample, the desktop one is two sentences and a button -
       * and a floor measured in vh sized the section for the tall answer, so
       * the short one sat marooned in a third of a screen of nothing. Padding
       * gives it room; the content decides the rest.
       *
       * Nothing here moves on its own. It used to rise and fade in with the
       * scroll, and a section faded to nothing is still in the tab order, so a
       * keyboard user could land on a download that was not on the screen. The
       * comparison above settling as it pins is the one movement the page makes.
       */
      aria-labelledby="get-heading"
      className="bg-band px-(--gutter) py-(--section-y)"
    >
      <div className="mx-auto w-full max-w-(--page-max)">
        <h2 id="get-heading" className="max-w-3xl text-section text-balance text-ink">
          Get X-Player
        </h2>

        {/*
          The two columns arrive at md, not lg.
          Between 640 and 1024 the section was a single stack inside a 64rem
          container, so a two-word option label sat on a 700px line and the
          file rows threw name and size to opposite ends of it. The questions
          take the narrower column because they are short by nature.
        */}
        <div className="mt-10 grid gap-10 sm:mt-14 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:gap-16">
          <div className="grid content-start gap-8">
            <Question label="What are you doing?" options={USES} value={use} onChange={(next) => setUse(next as Use)} />

            {use === 'embed' && (
              <>
                <Question
                  label="Where does it go?"
                  options={TARGETS}
                  value={target}
                  onChange={(next) => setTarget(next as Target)}
                />
                <Question
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
          <div className="grid content-start gap-5">
            <Manifest
              title={use === 'watch' ? 'The desktop app' : 'What you need'}
              count={use === 'watch' ? `version ${APP_VERSION}` : fileCount(target, playing)}
            >
              {use === 'watch' ? <AppResult platform={platform} /> : <FilesResult target={target} playing={playing} />}
            </Manifest>
            {use === 'embed' && <Snippet target={target} />}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ questions */

/*
 * A list of choices with a radio mark, not a stack of boxes.
 *
 * The questions are not a numbered sequence - the later two only appear because
 * of the first answer - so they carry no step numbers, and the options share
 * one tile with rules between them rather than each drawing its own. A rule
 * starts at the text, not at the tile's edge, the way a grouped list draws it,
 * and is a border rather than a filled line so that forced colours keep it.
 */
function Question({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { id: string; label: string; hint: string }[]
  value: string
  onChange: (id: string) => void
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([])

  /* Arrow keys move and choose; only the chosen option is a tab stop. Three
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
      <p className="mb-3.5 text-title text-ink">{label}</p>
      <div className={TILE} role="radiogroup" aria-label={label}>
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
              // No tint on the chosen row: the mark carries the state, and a
              // tint is what hover is for. Light hovers and presses one step
              // darker than the strips, since panel is the band's grey; more
              // contrast turns `line` into control grey, too dark to press on.
              // The rule's inset is padding + mark + gap: 1 + 1.375 + 0.875 =
              // 3.25rem, and 3.5rem from sm, where the padding is 1.25. The end
              // rows take the tile's corners, so the focus ring follows the
              // curve rather than being cut off by the tile's clip.
              className={`group relative flex min-h-16 w-full items-center gap-3.5 px-4 py-3 text-left transition-colors duration-150 first:rounded-t-tile last:rounded-b-tile hover:bg-raised active:bg-line dark:hover:bg-panel dark:active:bg-raised contrast-more:active:bg-raised sm:px-5 ${FOCUS_INSET} before:absolute before:top-0 before:right-0 before:left-[3.25rem] before:border-t before:border-line first:before:hidden sm:before:left-[3.5rem]`}
            >
              {/*
                Drawn as a border in both states - a thin ring, or one so thick
                it reads as a filled disc with a small centre - because forced
                colours keep borders and drop fills. A dot filled in ink left
                both options as empty rings there. The thin ring is `control`,
                the grey that clears the 3:1 a control's only edge is asked for,
                and 2px: 1.5px drew as one soft pixel on a 1x screen, lighter
                than the token. On the hover and press tints it darkens to
                `muted`, because `control` on a tint falls under 3:1.
              */}
              <span
                aria-hidden
                className={`size-[1.375rem] flex-none rounded-full transition-[border-width,border-color] duration-150 ${
                  on
                    ? 'border-[7px] border-ink'
                    : 'border-2 border-control group-hover:border-muted group-active:border-muted'
                }`}
              />
              <span className="grid min-w-0 gap-0.5">
                <span className={`text-body text-ink ${on ? 'font-medium' : ''}`}>{option.label}</span>
                <span className="text-caption text-muted">{option.hint}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function fileCount(target: Target, playing: Playing) {
  const n = assetsFor(target, playing).length
  return `${n} file${n === 1 ? '' : 's'}`
}

/* A file or a download, one to a row; rows are separated by a rule above each. */
const ROW = 'border-t border-line px-4 py-4 sm:px-5'

/*
 * A name and its figure, on one line while both fit. With the text at 200% on
 * a phone they did not, and the figure ran past the tile's edge, where the
 * clip cut it off; now it wraps under the name and keeps to the right. The
 * name gives way first (`min-w-0` on it, `ml-auto` on the figure).
 */
const HEAD = 'flex flex-wrap items-baseline justify-between gap-x-3'

/* ------------------------------------------------------------------- the app */

/*
 * Two kinds of action, and only one is ever filled. The download that matches
 * the visitor's own platform is the primary one; everything else is outlined
 * in `control`, which is the 3:1 edge a control is asked for.
 */
function AppResult({ platform }: { platform: PlatformId | null }) {
  const ordered = platform
    ? [...DOWNLOADS].sort((a, b) => Number(b.id === platform) - Number(a.id === platform))
    : DOWNLOADS

  if (!published) {
    return (
      <div className="border-t border-line px-4 py-5 sm:px-5">
        <p className="text-body text-ink">
          Not released yet. It builds and runs. The Windows installer ({DOWNLOADS[0].sizeMb} MB) has been built
          and used, but nothing has been published to download yet.
        </p>
        {sourcePublished ? (
          <a href={APP_REPO} target="_blank" rel="noreferrer noopener" className={`mt-4 ${SECONDARY}`}>
            Build it from source
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : (
          <p className="mt-4 text-caption text-pretty text-muted">
            The source is not on GitHub yet either, so there is nothing to link to. It goes up with the
            release.
          </p>
        )}
        <p className="mt-3 text-caption text-pretty text-muted">
          Verified on Windows. macOS and Linux are configured but never run.
        </p>
      </div>
    )
  }

  return (
    <>
      {ordered.map((download, index) => {
        const yours = index === 0 && download.id === platform
        return (
          <div key={download.id} className={ROW}>
            <div className={HEAD}>
              {/* Sans: a platform's name is a word, not machine text. */}
              <span className="min-w-0 text-body font-semibold text-ink">{download.label}</span>
              <span className="ml-auto text-caption tabular-nums text-muted">
                {download.sizeMb ? `${download.sizeMb} MB` : '—'}
              </span>
            </div>
            <p className="mt-1 text-caption text-muted">{download.format}</p>
            <p className="mt-1 max-w-[34rem] text-caption text-pretty text-muted">{download.note}</p>
            {download.released && !download.verified && (
              <p className="mt-1.5 text-caption text-bad">Built but never run on this platform</p>
            )}
            {download.released ? (
              <a href={downloadUrl(download.file)} className={`mt-3.5 ${yours ? PRIMARY : SECONDARY}`}>
                Download {download.label}
              </a>
            ) : (
              /* No button. The file is not in the release, and a button that
                 answers 404 is worse than a sentence saying why there isn't one. */
              <p className="mt-3 text-caption text-muted">Not in this release yet</p>
            )}
          </div>
        )
      })}
      <p className="border-t border-line px-4 py-1 sm:px-5">
        <a href={APP_RELEASES} target="_blank" rel="noreferrer noopener" className={TEXT_LINK}>
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
        // A file fetched only when a stream opens sits on a tint, set apart from what every page load costs.
        <div key={asset.name} className={`${ROW} ${asset.lazy ? STRIP : ''}`}>
          <div className={HEAD}>
            {/* A file name has no spaces to wrap at, so it may break anywhere. */}
            <span className="min-w-0 font-mono text-[0.9375rem] font-medium text-ink [overflow-wrap:anywhere]">
              {asset.name}
            </span>
            {/* The gzip figure leads on size, not on colour: it is a measurement
                taken once, not a reading that is changing. */}
            <span className="ml-auto grid justify-items-end text-body font-medium tabular-nums text-ink">
              {kb(asset.gzip)}
              <span className="text-micro font-normal text-muted">{kb(asset.raw)} raw</span>
            </span>
          </div>
          <p className="mt-1 text-caption text-muted">{asset.place}</p>
          <p className="mt-1 max-w-[34rem] text-caption text-pretty text-muted">{asset.what}</p>
          {asset.href && (
            <a
              href={asset.href}
              download={asset.href.startsWith('http') ? undefined : ''}
              className={`mt-3.5 ${SECONDARY}`}
            >
              {asset.href.startsWith('http') ? (
                <>
                  Open on the CDN
                  {/* Two of these can sit in one list, so each says which file
                      it opens; the words on screen stay the start of the name. */}
                  <span className="sr-only"> ({asset.name})</span>
                </>
              ) : (
                `Download ${asset.name}`
              )}
            </a>
          )}
        </div>
      ))}

      <dl className="border-t border-line px-4 py-3 sm:px-5">
        <div className="flex items-baseline justify-between gap-3 py-1">
          <dt className="text-caption text-muted">On every page load</dt>
          <dd className="text-figure tabular-nums text-ink">{kb(upfront)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 py-1">
          <dt className="text-caption text-muted">Only when a stream opens</dt>
          <dd className={deferred ? 'text-figure tabular-nums text-ink' : 'text-caption text-muted'}>
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
    <div className="grid gap-3">
      <div className={TILE}>
        <p id="snippet-label" className="px-4 pt-4 pb-3 text-body font-semibold text-ink sm:px-5">
          {snippet.label}
        </p>
        {/* Scrollable, so it has to be reachable by keyboard - a region a mouse
            can pan and a keyboard cannot is content some people simply lose. */}
        <pre
          tabIndex={0}
          role="region"
          aria-labelledby="snippet-label"
          // Forced colours drop the strip's tint, so there it gets rules above
          // and below to stay a block of its own inside the tile.
          className={`overflow-x-auto ${STRIP} px-4 py-4 font-mono text-[0.8125rem] leading-[1.65] text-ink forced-colors:border-y sm:px-5 ${FOCUS_INSET}`}
        >
          <code>{snippet.code}</code>
        </pre>
        <p className="px-4 py-3.5 text-caption text-pretty text-muted sm:px-5">{snippet.note}</p>
      </div>

      <p className="px-1 text-micro text-muted">Sizes measured from the files above on {MEASURED_AT}, not typed in.</p>
    </div>
  )
}

/*
 * The answer, as one tile. Its first child is the heading row and stays a `p`;
 * every file or download after it is a `div` of its own, directly inside.
 */
function Manifest({ title, count, children }: { title: string; count: string; children: React.ReactNode }) {
  return (
    <div className={TILE} aria-live="polite">
      <p className={`${HEAD} px-4 pt-4 pb-3 sm:px-5 sm:pt-5`}>
        <span className="min-w-0 text-title text-ink">{title}</span>
        <span className="ml-auto text-caption tabular-nums text-muted">{count}</span>
      </p>
      {children}
    </div>
  )
}
