import { copyFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Gives the generated Open Graph card a file extension, and points the pages at
 * it.
 *
 * Next's opengraph-image convention writes an extensionless file and emits a
 * meta tag pointing at `/opengraph-image?hash`. Vercel serves that with the
 * right content type. A plain static host - Netlify, GitHub Pages, nginx with
 * default rules - serves it as application/octet-stream, and every link preview
 * silently falls back to plain text.
 *
 * Setting `openGraph.images` in metadata does not help: the file convention
 * wins. So the fix happens here, on the build output, where it can be checked.
 */
const OUT = 'out'
const source = join(OUT, 'opengraph-image')

if (!existsSync(source)) {
  console.error(`postbuild: ${source} is missing - did the build run?`)
  process.exit(1)
}

copyFileSync(source, join(OUT, 'og.png'))

/** Rewrites the card URL in every page the export produced. */
function retargetCard(dir) {
  let changed = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      changed += retargetCard(path)
      continue
    }
    if (!entry.name.endsWith('.html')) continue

    const before = readFileSync(path, 'utf8')
    const after = before.replace(/\/opengraph-image(\?[a-z0-9]+)?/g, '/og.png')
    if (after !== before) {
      writeFileSync(path, after)
      changed += 1
    }
  }
  return changed
}

const pages = retargetCard(OUT)
console.log(`out/og.png written; card URL corrected in ${pages} page(s)`)
