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
          decoration. It is not amber because nothing here is live or chosen. */}
      <p className="font-mono text-micro uppercase tracking-[0.18em] text-muted">404</p>

      <h1 className="legend mt-4 text-[length:var(--text-section)] font-semibold leading-[1.02]">
        Nothing here.
      </h1>

      <p className="mt-4 max-w-md text-lead leading-relaxed text-muted">
        This site is one page. Whatever you were following pointed somewhere that does not exist.
      </p>

      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 rounded-lg bg-good px-5 py-3 text-lead font-semibold text-[#1a1206] transition-colors hover:bg-[#ffc04a] active:bg-[#e59a17] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-good"
      >
        Go to the page
      </Link>
    </main>
  )
}
