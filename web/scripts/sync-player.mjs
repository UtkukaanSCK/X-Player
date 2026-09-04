import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

/**
 * Copies the player's build output into this project.
 *
 * It used to be an `x-player: file:..` dependency, which npm installs as a
 * symlink from web/node_modules/x-player to the folder above. That folder
 * contains this one, so anything walking node_modules descends into itself
 * forever - Turbopack eventually says so in those exact words and dies:
 *
 *   'web/node_modules/x-player' is a symlink causes that causes an infinite loop!
 *
 * A copy has none of that. Nothing points outside the project, no tool has to be
 * told where the boundary is, and the cost is running this again after changing
 * the player - which `npm run dev` and `npm run build` both do.
 */
const DIST = resolve(import.meta.dirname, '../../dist')
const FROM = resolve(DIST, 'lib')
const TO = resolve(import.meta.dirname, '../vendor/x-player')

/*
 * The same build, served to visitors.
 *
 * The download wizard offers real files rather than describing them, so the
 * player's output is copied into public/ and measured there. Sizes shown on the
 * page come from these exact bytes; nothing is typed in by hand and nothing can
 * drift from what is actually served.
 */
const PUBLIC = resolve(import.meta.dirname, '../public/downloads')
const SIZES = resolve(import.meta.dirname, '../lib/generated/sizes.json')

if (!existsSync(FROM)) {
  console.error(`sync-player: ${FROM} is missing.\nBuild the player first: cd .. && npm run build`)
  process.exit(1)
}

rmSync(TO, { recursive: true, force: true })
mkdirSync(TO, { recursive: true })
cpSync(FROM, TO, { recursive: true })

for (const kind of ['embed', 'lib']) {
  const from = resolve(DIST, kind)
  if (!existsSync(from)) {
    console.error(`sync-player: ${from} is missing.\nBuild the player first: cd .. && npm run build`)
    process.exit(1)
  }
  const to = resolve(PUBLIC, kind)
  rmSync(to, { recursive: true, force: true })
  mkdirSync(to, { recursive: true })
  cpSync(from, to, { recursive: true })
}

/** Measured from the copies that are actually served. */
const measure = (file) => {
  const bytes = readFileSync(file)
  return { raw: bytes.length, gzip: gzipSync(bytes, { level: 9 }).length }
}

const files = {
  embed: measure(resolve(PUBLIC, 'embed/x-player.iife.js')),
  hls: measure(resolve(PUBLIC, 'embed/hls.min.js')),
  libJs: measure(resolve(PUBLIC, 'lib/x-player.es.js')),
  libCss: measure(resolve(PUBLIC, 'lib/style.css')),
  measuredAt: new Date().toISOString().slice(0, 10),
}

mkdirSync(dirname(SIZES), { recursive: true })
writeFileSync(SIZES, JSON.stringify(files, null, 2) + '\n')

const kb = (n) => (n / 1024).toFixed(1).padStart(7) + ' kB'
console.log(`player synced from ${FROM}`)
for (const [key, value] of Object.entries(files)) {
  if (key === 'measuredAt') continue
  console.log(`  ${key.padEnd(7)} ${kb(value.raw)} raw  ${kb(value.gzip)} gzip`)
}
