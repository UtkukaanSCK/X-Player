// Computes Subresource Integrity hashes for the embed bundle.
//
// The site renders the copy-paste <script> snippet with these hashes, so anyone
// serving the file from a CDN gets tamper detection by default instead of being
// told to add it later.
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = 'dist/embed'
const OUT = join(DIR, 'integrity.json')

const files = readdirSync(DIR).filter((f) => f.endsWith('.js'))
if (files.length === 0) {
  console.error(`sri: no .js files in ${DIR} - run build:embed first`)
  process.exit(1)
}

const manifest = {}
for (const file of files) {
  const bytes = readFileSync(join(DIR, file))
  const digest = createHash('sha384').update(bytes).digest('base64')
  manifest[file] = { integrity: `sha384-${digest}`, bytes: bytes.length }
}

writeFileSync(OUT, JSON.stringify(manifest, null, 2) + '\n')
for (const [file, info] of Object.entries(manifest)) {
  console.log(`${file}  ${info.integrity}`)
}
