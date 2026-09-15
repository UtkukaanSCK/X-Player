import { REPO_URL, SITE_NAME } from '@/lib/site'

/**
 * The name of the thing, and where it lives.
 *
 * Not sticky. The comparison below pins itself to the viewport for a whole
 * screen of scrolling, and a bar pinned above it would take height from the two
 * videos on exactly the phones where they are already smallest. It sits over
 * the top of the page and scrolls away with it.
 */
export function SiteHeader() {
  return (
    // The gutter sits outside the width cap, as it does on every section, and
    // the cap is the comparison's own: .proof-column narrows on a short screen,
    // and a plain max-w-6xl left the mark 144px or more left of the heading.
    <header className="absolute inset-x-0 top-0 z-10 px-5 sm:px-8">
      <div className="proof-column flex h-16 items-center justify-between">
        <span className="flex items-center gap-2.5 text-body font-semibold tracking-[-0.01em] text-ink">
          <Mark />
          {SITE_NAME}
        </span>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="-mr-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-2 text-body text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          GitHub
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>
    </header>
  )
}

/** The app icon, drawn rather than fetched: an amber cross on an ink square. */
function Mark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden focusable="false">
      <rect width="22" height="22" rx="5.5" fill="var(--color-ink)" />
      <path d="M7.5 7.5l7 7M14.5 7.5l-7 7" stroke="var(--color-mark)" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}
