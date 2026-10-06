import { REPO_URL, SITE_NAME } from '@/lib/site'
import { Mark } from './Mark'
import { FOCUS_INSET } from './ui'

/**
 * The name of the thing, where it lives, and the way to get it.
 *
 * Fixed, so that "Get it" is one press from anywhere: from the top, the
 * downloads are two screens of pinned comparison away. The pinned box's own
 * top padding (Proof.tsx) is what keeps the heading clear of the bar's 48px.
 *
 * The gutter is on the bar and the row inside it is capped at the page width,
 * so the mark and the pill line up with the edges of GetIt, Source and the
 * footer. A gutter inside the cap would set them 40px in from everything else.
 *
 * Glass over whatever scrolls beneath it (.glass, globals.css): opaque where
 * blur is missing, under reduced transparency, and under more contrast. Every
 * string in it is ink, because the worst thing that can pass under the glass -
 * a black video frame in light, a white one in dark - leaves ink at 11.14 and
 * 8.53 but muted at 3.94 and 3.71.
 */
export function SiteHeader() {
  return (
    <header className="glass fixed inset-x-0 top-0 z-50 h-(--header-h) px-(--gutter)">
      <div className="mx-auto flex h-full max-w-(--page-max) items-center justify-between">
        {/* The way back to the top. */}
        <a
          href="#proof"
          className={`-ml-1.5 inline-flex min-h-11 items-center gap-2 rounded-full px-1.5 text-[1.0625rem] font-semibold tracking-[-0.012em] whitespace-nowrap text-ink ${FOCUS_INSET}`}
        >
          <Mark size={22} />
          {SITE_NAME}
        </a>

        {/* No link to #source: it says the same as GitHub, which goes to the repository itself. */}
        <nav aria-label="Site" className="-mr-1 flex items-center gap-1">
          {/*
            Leaves the bar when the row would not fit: a reader who has raised
            their browser's text size on a phone. The threshold is in rem, so it
            moves with that setting - 288px at the default 16px, below any real
            screen, and 432px at 24px. Source still links to the repository.
          */}
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer noopener"
            className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-3 text-caption text-ink transition-colors duration-150 hover:bg-ink/6 active:bg-ink/10 max-[18rem]:hidden ${FOCUS_INSET}`}
          >
            GitHub
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          {/*
            The target is the link, 44px; the pill drawn inside it is 32. A
            pill the full 44 would crowd a 48px bar, and one only 32 tall would
            be a target too small for a thumb. The ring is drawn on the pill,
            which is the thing that looks pressable.
          */}
          <a href="#get" className="group inline-flex min-h-11 min-w-11 items-center justify-center px-1 outline-none">
            <span className="rounded-full bg-ink px-3.5 py-1.5 text-caption font-medium whitespace-nowrap text-on-ink transition-colors duration-150 group-hover:bg-ink-hover group-active:bg-ink-press group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-ink forced-colors:border forced-colors:border-[ButtonText]">
              Get it
            </span>
          </a>
        </nav>
      </div>
    </header>
  )
}
