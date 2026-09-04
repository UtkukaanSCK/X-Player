'use client'

import { useRef, useState } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'

const REPO = 'https://github.com/UtkukaanSCK/X-Player'

export function Source() {
  const container = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()

  /*
   * Measured against a section that is not itself sticky, and only while it is
   * entering. Scrubbing a target inside a sticky container gave readings that
   * went up and then back down, because a pinned element stops moving and the
   * progress derived from its box stops meaning anything.
   */
  const { scrollYProgress } = useScroll({ target: container, offset: ['start end', 'center center'] })

  /*
   * Rises into the space the comparison is vacating.
   *
   * This is a separate section - its own element, its own scroll listener, its
   * own place in the document - but it is not meant to look like one. The
   * section above recedes over the last of its scroll while this one comes up
   * through the same part of the screen, so the two read as one movement.
   */
  const y = useTransform(scrollYProgress, [0, 0.3], reduced ? [0, 0] : [90, 0])
  const opacity = useTransform(scrollYProgress, [0, 0.25], reduced ? [1, 1] : [0, 1])
  const scale = useTransform(scrollYProgress, [0, 0.3], reduced ? [1, 1] : [0.96, 1])

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
      id="source"
      /*
       * Nothing marks where the section above ends: no rule, no gap, no change
       * of ground. The comparison scrolls away while this rises to meet it, so
       * the two read as one movement even though they are separate elements
       * with separate anchors.
       */
      aria-labelledby="source-heading"
      className="relative flex min-h-[72vh] items-center justify-center px-5 pb-28 pt-10 sm:px-8"
    >
      <div className="w-full">
        <motion.div
          data-stage="source"
          style={revealed ? { y: 0, opacity: 1, scale: 1 } : { y, opacity, scale }}
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
          className="mx-auto w-full max-w-3xl text-center"
        >
        <h2 id="source-heading" className="legend text-[length:var(--text-section)] font-semibold leading-[1.02]">
          All of it is on GitHub.
        </h2>

        <p className="mx-auto mt-5 max-w-xl text-lead leading-relaxed text-muted">
          The player, the throttling worker behind the comparison above, and the tests that keep it honest.
          MIT licensed, so read it, take it, change it.
        </p>

        <div className="mt-9 flex flex-col items-center gap-4">
          <a
            href={REPO}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2.5 rounded-lg bg-good px-6 py-3.5 text-lead font-semibold text-[#1a1206] transition-colors hover:bg-[#ffc04a] active:bg-[#e59a17] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-good"
          >
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
          <p className="font-mono text-caption text-muted">github.com/UtkukaanSCK/X-Player</p>
        </div>
        </motion.div>
      </div>
    </section>
  )
}

function GitHubMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden focusable="false">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  )
}
