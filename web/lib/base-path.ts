/**
 * Works out the path prefix the site is served under.
 *
 * Shared by next.config.ts and lib/site.ts, which have to agree exactly: the
 * config decides what Next writes into its own asset URLs, and site.ts decides
 * what the page builds by hand. A disagreement between them is a site where the
 * bundles load and the demo clip 404s.
 *
 * The input is accepted with or without slashes, so a workflow can hand over a
 * bare repository name. That also sidesteps Git Bash on Windows, which rewrites
 * a leading slash into a drive path before the build ever sees it.
 */
export function normalizeBasePath(raw: string | undefined): string {
  const value = (raw ?? '').trim()
  if (value === '' || value === '/') return ''
  return `/${value.replace(/^\/+|\/+$/g, '')}`
}
