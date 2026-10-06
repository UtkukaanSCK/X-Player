import { REPO_URL } from '@/lib/site'
import { PRIMARY_LG } from './ui'

/**
 * Where the code is, said once.
 *
 * Rendered on the server and nothing more: no state, no motion. It used to rise
 * and fade in with the scroll, and an element faded to nothing is still in the
 * tab order, so a keyboard user could land on the button before it could be
 * seen; settling the animation on focus patched that and made a mouse press
 * slide the button out from under the cursor. The comparison settling as it
 * pins is the one movement the page makes.
 *
 * On the ground, between the wizard's band and the footer's, so the change of
 * surface is what ends one section and starts the next.
 */
export function Source() {
  return (
    <section id="source" aria-labelledby="source-heading" className="px-(--gutter) py-(--section-y)">
      <div className="mx-auto max-w-[40rem] text-center">
        <h2 id="source-heading" className="text-section text-balance text-ink">
          All of it is on GitHub.
        </h2>

        <p className="mx-auto mt-4 max-w-[34rem] text-lead text-pretty text-muted">
          The player, the throttling worker behind the comparison above, and the tests that keep it honest.
          MIT licensed, so read it, take it, change it.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3">
          <a href={REPO_URL} target="_blank" rel="noreferrer noopener" className={PRIMARY_LG}>
            <GitHubMark />
            View on GitHub
            <span className="sr-only"> (opens in a new tab)</span>
          </a>

          {/*
            The address, not a second link to the same place.
            There were two adjacent links here pointing at one destination:
            two tab stops and two identical announcements for one thing. The
            URL is worth showing - it is how someone checks where the button
            goes before pressing it - so it stays, as text.
          */}
          <p className="text-caption text-muted">github.com/UtkukaanSCK/X-Player</p>
        </div>
      </div>
    </section>
  )
}

/* Drawn in the text colour, so forced colours repaint it with the label. */
function GitHubMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="currentColor" aria-hidden focusable="false">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  )
}
