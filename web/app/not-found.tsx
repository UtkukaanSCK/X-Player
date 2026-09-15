import Link from 'next/link'

/**
 * There is one page on this site, so a 404 means a link that was wrong or a
 * URL that was guessed. It says that plainly and points at the only thing
 * there is, rather than apologising at length.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-5 text-center sm:px-8">
      {/* The status code, which is information; not an eyebrow label, which is
          decoration. */}
      <p className="text-caption tabular-nums text-muted">404</p>

      <h1 className="mt-3 text-[length:var(--text-section)] font-semibold leading-[1.08] tracking-[-0.025em] text-ink">
        Nothing here.
      </h1>

      <p className="mt-4 max-w-md text-lead leading-relaxed text-muted">
        This site is one page. Whatever you were following pointed somewhere that does not exist.
      </p>

      <Link
        href="/"
        className="mt-8 inline-flex min-h-12 items-center rounded-lg bg-ink px-5 text-body font-medium text-white transition-colors hover:bg-ink-hover active:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        Go to the page
      </Link>
    </main>
  )
}
