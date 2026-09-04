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
 */
export function ProofHeading() {
  return (
    <header className="mx-auto w-full max-w-6xl">
      {/*
        No label above the heading, and no second colour inside it.
        The section is not a step in a sequence, so numbering it stated nothing
        true, and greying the back half of a sentence breaks one thought into
        two ranks for no reason a reader could name.
      */}
      <h1 id="proof-heading" className="legend text-[length:var(--text-hero)] font-semibold leading-[1.02] text-balance">
        A bad connection, shown rather than described.
      </h1>
    </header>
  )
}
