// Measures the real build output and writes it where the site can import it.
//
// The landing page states bundle sizes. Those numbers are generated here from
// the actual files rather than typed into the markup, so a claim on the site can
// never drift away from what the build produces.
import { gzipSync, brotliCompressSync } from 'node:zlib'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const TARGETS = {
  embed: 'dist/embed/x-player.iife.js',
  hls: 'dist/embed/hls.min.js',
  libJs: 'dist/lib/x-player.es.js',
  libCss: 'dist/lib/style.css',
}
const OUT = 'src/site/generated/sizes.json'

const missing = Object.values(TARGETS).filter((f) => !existsSync(f))
if (missing.length) {
  console.error(`measure-sizes: missing build output:\n  ${missing.join('\n  ')}\nRun the builds first.`)
  process.exit(1)
}

const measure = (file) => {
  const bytes = readFileSync(file)
  return { raw: bytes.length, gzip: gzipSync(bytes, { level: 9 }).length, brotli: brotliCompressSync(bytes).length }
}

const sizes = Object.fromEntries(Object.entries(TARGETS).map(([key, file]) => [key, measure(file)]))
sizes.measuredAt = new Date().toISOString().slice(0, 10)

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(sizes, null, 2) + '\n')

const kb = (n) => (n / 1024).toFixed(1) + ' kB'
for (const [key, file] of Object.entries(TARGETS)) {
  console.log(`${key.padEnd(7)} ${kb(sizes[key].raw).padStart(9)} raw  ${kb(sizes[key].gzip).padStart(9)} gzip  ${file}`)
}
