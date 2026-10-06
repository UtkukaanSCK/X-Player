import type { Metadata } from 'next'
import Link from 'next/link'
import { Mark } from '@/components/Mark'
import { PRIMARY_LG } from '@/components/ui'
import { SITE_NAME } from '@/lib/site'

/* Its own title, or the tab and the history name this page as the home page. */
export const metadata: Metadata = {
  title: `Page not found — ${SITE_NAME}`,
}

/**
 * There is one page on this site, so a 404 means a link that was wrong or a
 * URL that was guessed. It says that plainly and points at the only thing
 * there is, rather than apologising at length.
 *
 * No site header: its brand link goes to #proof, which is not on this page.
 * The mark stands in for it, so the page still says whose it is.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-(--gutter) py-16 text-center">
      <Mark size={44} />

      {/* The status code, which is information; not an eyebrow label, which is
          decoration. */}
      <p className="mt-8 text-caption tabular-nums text-muted">404</p>

      <h1 className="mt-2 text-section text-balance text-ink">Nothing here.</h1>

      <p className="mt-4 max-w-[28rem] text-lead text-pretty text-muted">
        This site is one page. Whatever you were following pointed somewhere that does not exist.
      </p>

      <Link href="/" className={`mt-8 ${PRIMARY_LG}`}>
        Go to the page
      </Link>
    </main>
  )
}
