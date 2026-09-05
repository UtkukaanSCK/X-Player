import { gzipSync } from 'node:zlib'
import { readFileSync, existsSync } from 'node:fs'

/**
 * What the library weighs, and where the weight is.
 *
 * Gzip rather than raw, because gzip is what a browser downloads and raw
 * rewards the wrong things - renaming a variable moves the raw number and
 * changes nothing a visitor experiences.
 *
 * The per-module table works because the bundler leaves `//#region src/...`
 * markers in the output, so every byte can be attributed to the file it came
 * from. Those are raw bytes: gzip is a property of the whole stream and cannot
 * honestly be split per module, so the shares say where to look, not what a
 * given file costs on the wire.
 *
 *   node scripts/size.mjs            what it weighs now
 *   node scripts/size.mjs --against  compared with a saved baseline
 */
const BUNDLES = [
  ['dist/lib/x-player.es.js', 'the library, as a module'],
  ['dist/lib/x-player.cjs.js', 'the library, for require()'],
  ['dist/lib/style.css', 'the stylesheet'],
  ['dist/embed/x-player.iife.js', 'the embed bundle, Preact included'],
]

const BASELINE = process.env.SIZE_BASELINE ?? '.size-baseline.json'

const weigh = (file) => {
  const raw = readFileSync(file)
  return { raw: raw.length, gzip: gzipSync(raw, { level: 9 }).length }
}

const kb = (n) => `${(n / 1024).toFixed(2)} kB`

const missing = BUNDLES.filter(([f]) => !existsSync(f)).map(([f]) => f)
if (missing.length) {
  console.error(`size: ${missing.join(', ')} missing. Run npm run build first.`)
  process.exit(1)
}

const now = Object.fromEntries(BUNDLES.map(([file]) => [file, weigh(file)]))

const before = process.argv.includes('--against') && existsSync(BASELINE)
  ? JSON.parse(readFileSync(BASELINE, 'utf8'))
  : null

console.log('  bundle                                      raw        gzip' + (before ? '     change' : ''))
for (const [file, what] of BUNDLES) {
  const { raw, gzip } = now[file]
  let delta = ''
  if (before?.[file]) {
    const d = gzip - before[file].gzip
    const pct = ((d / before[file].gzip) * 100).toFixed(1)
    delta = d === 0 ? '        same' : `   ${d > 0 ? '+' : ''}${d} B (${d > 0 ? '+' : ''}${pct}%)`
  }
  console.log(`  ${file.replace('dist/', '').padEnd(38)}${kb(raw).padStart(9)}${kb(gzip).padStart(12)}${delta}`)
  console.log(`  ${' '.repeat(4)}${what}`)
}

/* Where the bytes are, from the region markers the bundler leaves behind. */
const src = readFileSync('dist/lib/x-player.es.js', 'utf8')
const marks = [...src.matchAll(/\/\/#region (\S+)/g)].map((m) => ({ name: m[1], at: m.index }))
if (marks.length) {
  const rows = marks
    .map((m, i) => ({ name: m.name, bytes: (marks[i + 1]?.at ?? src.length) - m.at }))
    .sort((a, b) => b.bytes - a.bytes)
  const total = rows.reduce((s, r) => s + r.bytes, 0)
  console.log('\n  where the library bundle goes (raw bytes, attributed by module)')
  for (const r of rows) {
    const share = ((r.bytes / total) * 100).toFixed(1)
    const bar = '#'.repeat(Math.max(1, Math.round(r.bytes / total * 40)))
    console.log(`  ${r.name.replace(/^src\//, '').padEnd(38)}${String(r.bytes).padStart(6)}  ${share.padStart(5)}%  ${bar}`)
  }
}

if (process.argv.includes('--save')) {
  const { writeFileSync } = await import('node:fs')
  writeFileSync(BASELINE, JSON.stringify(now, null, 2))
  console.log(`\n  saved as the baseline in ${BASELINE}`)
}
