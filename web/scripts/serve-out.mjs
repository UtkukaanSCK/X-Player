import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve, sep } from 'node:path'

/**
 * Serves the exported site the way a static host would.
 *
 * The end-to-end suites are worth far more run against the thing that will
 * actually be deployed than against the dev server, which resolves modules on
 * the fly and serves files with different headers.
 */
/* Overridable so the Pages layout - the export nested under /<repo>/ - can be
   served and checked exactly as GitHub will serve it. */
const ROOT = resolve(process.env.SERVE_ROOT ?? 'out')
const PORT = Number(process.env.PORT ?? 5199)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)
  // Normalise away any ".." before it can reach the filesystem, then put the
  // separators back to forward slashes: on Windows normalize() returns
  // backslashes, and a rule matching "media/" then silently never fires.
  const rel = normalize(decodeURIComponent(url.pathname))
    .replace(/^[/\\]+/, '')
    .split(/[/\\]/)
    .join('/')
  let file = resolve(ROOT, rel)

  // Both sides resolved before comparing, and the separator required after
  // the root. Comparing a joined path against a raw root looks equivalent and
  // is not: on Windows join() returns backslashes while an absolute root keeps
  // whatever it was given, so the two disagree and every request is refused.
  // The trailing separator matters for its own reason - without it a sibling
  // directory named "outdated" would satisfy a guard meant to admit only "out".
  if (file !== ROOT && !file.startsWith(ROOT + sep)) {
    res.writeHead(403).end('forbidden')
    return
  }
  // A directory asked for without its trailing slash is redirected to one with,
  // which is what GitHub Pages does. It is not cosmetic: a service worker scope
  // of "/X-Player/" does not cover the URL "/X-Player", so serving that page
  // directly leaves it uncontrolled and the throttle with nothing driving it.
  if (existsSync(file) && statSync(file).isDirectory()) {
    if (!url.pathname.endsWith('/')) {
      res.writeHead(301, { location: `${url.pathname}/${url.search}` }).end()
      return
    }
    file = join(file, 'index.html')
  }
  if (!existsSync(file) && existsSync(`${file}.html`)) file = `${file}.html`

  if (!existsSync(file)) {
    const notFound = join(ROOT, '404.html')
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' })
    if (existsSync(notFound)) createReadStream(notFound).pipe(res)
    else res.end('not found')
    return
  }

  const size = statSync(file).size
  const headers = {
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    'accept-ranges': 'bytes',
  }
  // Matches vercel.json: the demo clip must never come from a cache, or the
  // throttling has nothing to throttle.
  if (rel.startsWith('media/')) headers['cache-control'] = 'no-store'

  // Byte ranges, because a media element asks for them and a host that cannot
  // answer makes seeking impossible - which would be a difference between this
  // and production rather than a rehearsal of it.
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '')
  if (range) {
    const start = range[1] ? Number(range[1]) : 0
    const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1
    if (start >= size || start > end) {
      res.writeHead(416, { 'content-range': `bytes */${size}` }).end()
      return
    }
    res.writeHead(206, {
      ...headers,
      'content-length': String(end - start + 1),
      'content-range': `bytes ${start}-${end}/${size}`,
    })
    createReadStream(file, { start, end }).pipe(res)
    return
  }

  res.writeHead(200, { ...headers, 'content-length': String(size) })
  createReadStream(file).pipe(res)
}).listen(PORT, () => console.log(`serving ${ROOT} on http://localhost:${PORT}`))
