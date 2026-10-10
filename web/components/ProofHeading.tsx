/**
 * The page's only h1, kept out of the client-only comparison.
 *
 * The comparison itself cannot be server-rendered - two video elements, a
 * service worker and scroll transforms have nothing a server could produce -
 * so it is loaded with `ssr: false`. That is right for the apparatus and wrong
 * for the sentence above it: with the heading inside, the exported HTML had no
 * h1 at all and the first heading in the document was the wizard's h2. A
 * crawler, a reader mode, and anyone arriving before hydration all saw a page
 * that never says what it is about.
 *
 * So the heading lives here, in one place used by both the real section and the
 * placeholder that stands in for it, and the text cannot drift between them.
 * The box they both sit in and the frames they both draw live here for the same
 * reason: the placeholder is only worth having if it has the real geometry, or
 * the heading jumps when the comparison arrives.
 */
export function ProofHeading() {
  return (
    // Its own width, wider than the videos and not narrowed by the screen's
    // height as their column is: two balanced lines from about 430px up, and
    // every line here is height the videos cannot have.
    <header className="mx-auto w-full max-w-[52rem] text-center">
      {/*
        No label above the heading, and no second colour inside it.
        The section is not a step in a sequence, so numbering it stated nothing
        true, and greying the back half of a sentence breaks one thought into
        two ranks for no reason a reader could name.
      */}
      <h1 id="proof-heading" className="text-hero text-balance text-ink">
        X-Player, on a throttled connection.
      </h1>
    </header>
  )
}

/**
 * The pinned box, held to the screen while the section scrolls past.
 *
 * The top padding is the fixed header plus 20px, and the heading and the
 * comparison are centred in the height left below it. On a screen too short to
 * hold it (`short`, in globals.css) it stops pinning and scrolls like the rest
 * of the page instead of cutting its own bottom off.
 */
export const PROOF_BOX =
  'sticky top-0 flex h-svh flex-col justify-center gap-5 overflow-hidden px-(--gutter) pt-[calc(var(--header-h)+1.25rem)] pb-5 sm:gap-7 sm:pb-6 short:static short:h-auto short:overflow-visible short:pb-16'

/**
 * A video frame, in two layers: the shadow outside, and the clip inside.
 *
 * The shadow and the stall ring are both box-shadows, so they live on different
 * elements and neither erases the other. The corner grows with the panel (it is
 * a size container), 10px on a phone and about 17px at 1440.
 */
export const FRAME = 'stage-frame frame-shadow rounded-[clamp(0.625rem,3.2cqi,1.25rem)]'

/**
 * The clip, with a 1px edge drawn inside it over the footage: it shows where a
 * pale sky meets the white ground in light, and where a black frame meets the
 * black ground in dark. The edge is a layer of its own on top rather than an
 * outline on this element: the player's inset focus ring was found painted
 * over by its playing video, and a layer above the video cannot be.
 */
export const SCREEN =
  "relative aspect-video w-full overflow-hidden rounded-[inherit] bg-black after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:ring-1 after:ring-frame-edge after:ring-inset after:content-['']"
